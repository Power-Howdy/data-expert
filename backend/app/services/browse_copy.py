"""Optional browse copies: a file rewritten with small row groups so any page can be read in milliseconds.

Parquet files written as one huge row group must be decoded up to the requested rows (or completely), so jumping
deep into them takes seconds; large text formats (CSV, JSON Lines, ...) must be scanned from the start. A browse copy
holds the same rows as Parquet with BROWSE_GROUP_ROWS-row groups. It is built on request, in the background, and is
keyed by the source file's size and modification time, so it is never used for a changed file.
"""
import logging
import shutil
import threading
from pathlib import Path
from typing import Dict, Optional

import pyarrow as pa
import pyarrow.parquet as pq

from app.core.config import settings
from app.models.schemas import BrowseCopyStatus, Dataset, DataFormat
from app.services.data_loader import dataset_manager
from app.services.row_cache import row_cache

logger = logging.getLogger(__name__)
BROWSE_GROUP_ROWS = 10_000
# A Parquet row group above this (uncompressed) makes deep pages slow; other formats need a copy above this file size.
SLOW_GROUP_BYTES = 256 * 1024 * 1024
SLOW_FILE_BYTES = 256 * 1024 * 1024


class _Job:
    def __init__(self, total: int):
        self.total = total
        self.done = 0
        self.error: Optional[str] = None
        self.cancelled = False
        self.thread: Optional[threading.Thread] = None


class BrowseCopies:
    def __init__(self, base_path: Optional[str] = None):
        self.base = Path(base_path or Path(settings.data.registry_path).parent / "browse_copies")
        self._jobs: Dict[str, _Job] = {}
        self._lock = threading.RLock()

    # ---------- paths ----------

    def _path(self, dataset: Dataset) -> Path:
        stat = Path(dataset.path).stat()
        return self.base / dataset.id / f"{stat.st_size}-{stat.st_mtime_ns}.parquet"

    def ready_path(self, dataset: Dataset) -> Optional[str]:
        """The copy to read pages from, if one exists for the file's current version."""
        try:
            path = self._path(dataset)
        except OSError:
            return None
        return str(path) if path.exists() else None

    # ---------- status ----------

    @staticmethod
    def needed(dataset: Dataset) -> bool:
        if dataset.format != DataFormat.PARQUET:
            return dataset.size_bytes >= SLOW_FILE_BYTES
        try:
            meta = pq.ParquetFile(dataset.path).metadata
        except (OSError, pa.ArrowException):
            return False
        return any(meta.row_group(i).total_byte_size > SLOW_GROUP_BYTES for i in range(meta.num_row_groups))

    def status(self, dataset_id: str) -> BrowseCopyStatus:
        dataset = self._dataset(dataset_id)
        ready = self.ready_path(dataset)
        if ready:
            return BrowseCopyStatus(state="ready", needed=True, done=dataset.row_count, total=dataset.row_count,
                                    size_bytes=Path(ready).stat().st_size)
        job = self._jobs.get(dataset_id)
        if job and job.error:
            return BrowseCopyStatus(state="error", needed=True, done=job.done, total=job.total, error=job.error)
        if job:
            return BrowseCopyStatus(state="building", needed=True, done=job.done, total=job.total)
        return BrowseCopyStatus(state="missing", needed=self.needed(dataset), total=dataset.row_count)

    # ---------- building ----------

    def build(self, dataset_id: str) -> BrowseCopyStatus:
        """Start building the copy in the background (no-op if it is ready or already building)."""
        with self._lock:
            current = self.status(dataset_id)
            if current.state in ("ready", "building"):
                return current
            dataset = self._dataset(dataset_id)
            job = _Job(dataset.row_count)
            self._jobs[dataset_id] = job
            job.thread = threading.Thread(
                target=self._build, args=(dataset, self._path(dataset), job), daemon=True, name=f"browse-{dataset_id}",
            )
            job.thread.start()
            return self.status(dataset_id)

    def _build(self, dataset: Dataset, target: Path, job: _Job) -> None:
        tmp = target.with_suffix(".tmp")
        writer: Optional[pq.ParquetWriter] = None
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            for batch in self._batches(dataset):
                if job.cancelled:
                    raise InterruptedError("cancelled")
                table = pa.Table.from_batches([batch]) if isinstance(batch, pa.RecordBatch) else batch
                if writer is None:
                    writer = pq.ParquetWriter(tmp, table.schema, compression="zstd", compression_level=1)
                writer.write_table(table, row_group_size=BROWSE_GROUP_ROWS)
                job.done += table.num_rows
            if writer is None:
                raise ValueError("The file has no rows")
            writer.close()
            writer = None
            tmp.replace(target)
            for old in target.parent.iterdir():
                if old != target:
                    old.unlink(missing_ok=True)
            with self._lock:
                if self._jobs.get(dataset.id) is job:
                    del self._jobs[dataset.id]
            logger.info(f"Browse copy of {dataset.name} built: {job.done} rows")
        except Exception as e:
            if writer is not None:
                writer.close()
            tmp.unlink(missing_ok=True)
            if not job.cancelled:
                logger.exception(f"Building the browse copy of {dataset.name} failed")
                job.error = str(e) or type(e).__name__

    @staticmethod
    def _batches(dataset: Dataset):
        """The source rows in BROWSE_GROUP_ROWS batches, read as a stream so memory stays flat."""
        if dataset.format == DataFormat.PARQUET:
            file = pq.ParquetFile(dataset.path, buffer_size=1 << 20, pre_buffer=False)
            try:
                yield from file.iter_batches(batch_size=BROWSE_GROUP_ROWS)
            finally:
                file.close()
            return
        lf = dataset_manager.get_dataframe(dataset.id)
        for frame in lf.collect_batches(chunk_size=BROWSE_GROUP_ROWS):
            yield frame.to_arrow()

    # ---------- removal ----------

    def delete(self, dataset_id: str) -> bool:
        """Stop any build and remove the dataset's copies. Returns whether there was a copy or a build."""
        with self._lock:
            job = self._jobs.pop(dataset_id, None)
        if job and job.thread and job.thread.is_alive():
            job.cancelled = True
            job.thread.join(timeout=60)
        folder = self.base / dataset_id
        existed = bool(job and not job.error) or (folder.exists() and any(folder.glob("*.parquet")))
        if folder.exists():
            for copy in folder.glob("*.parquet"):
                row_cache.release(str(copy))
            shutil.rmtree(folder, ignore_errors=True)
        return existed

    @staticmethod
    def _dataset(dataset_id: str) -> Dataset:
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise KeyError(f"Dataset {dataset_id} not found")
        return dataset


browse_copies = BrowseCopies()
