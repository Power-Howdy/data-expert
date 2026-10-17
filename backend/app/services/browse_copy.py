"""Optional browse copies: a file rewritten in small, independently readable batches, so any page can be read in
milliseconds and searches can scan it fast.

Parquet files written as one huge row group must be decoded up to the requested rows (or completely), so jumping
deep into them takes seconds; large text formats (CSV, JSON Lines, ...) must be scanned from the start. A browse copy
holds the same rows as an Arrow IPC file (zstd-compressed) with BROWSE_GROUP_ROWS-row batches. Arrow batches decode
with a single decompression pass, several times faster than Parquet pages, which keeps full-text scans of big files
short. The copy is built on request, in the background, and is keyed by the source file's size and modification time,
so it is never used for a changed file.
"""
import bisect
import logging
import shutil
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

import polars as pl
import pyarrow as pa
import pyarrow.ipc as ipc
import pyarrow.parquet as pq

from app.core.config import settings
from app.models.schemas import BrowseCopyStatus, Dataset, DataFormat
from app.services.data_loader import dataset_manager

logger = logging.getLogger(__name__)
BROWSE_GROUP_ROWS = 10_000
# A Parquet row group above this (uncompressed) makes deep pages slow; other formats need a copy above this file size.
SLOW_GROUP_BYTES = 256 * 1024 * 1024
SLOW_FILE_BYTES = 256 * 1024 * 1024
CACHED_BATCHES = 3


class _Job:
    def __init__(self, total: int):
        self.total = total
        self.done = 0
        self.error: Optional[str] = None
        self.cancelled = False
        self.thread: Optional[threading.Thread] = None


def read_batches(path: str, batches: List[int], columns: Optional[List[str]] = None) -> pl.DataFrame:
    """Batches of a browse copy as one frame, decoding only `columns` (all when None)."""
    with pa.memory_map(path) as source:
        options = None
        if columns is not None:
            names = ipc.open_file(source).schema.names
            options = ipc.IpcReadOptions(included_fields=[names.index(c) for c in columns])
        reader = ipc.open_file(source, options=options)
        table = pa.Table.from_batches([reader.get_batch(b) for b in batches])
    return pl.from_arrow(table)


class BrowseCopies:
    def __init__(self, base_path: Optional[str] = None):
        self.base = Path(base_path or Path(settings.data.registry_path).parent / "browse_copies")
        self._jobs: Dict[str, _Job] = {}
        self._needed: Dict[str, bool] = {}
        self._starts: Dict[str, List[int]] = {}
        self._batches: "OrderedDict[tuple, pl.DataFrame]" = OrderedDict()
        self._lock = threading.RLock()
        for old in self.base.glob("*/*.parquet"):
            old.unlink(missing_ok=True)

    # ---------- paths ----------

    def _path(self, dataset: Dataset) -> Path:
        stat = Path(dataset.path).stat()
        return self.base / dataset.id / f"{stat.st_size}-{stat.st_mtime_ns}.arrow"

    def ready_path(self, dataset: Dataset) -> Optional[str]:
        """The copy to read rows from, if one exists for the file's current version."""
        try:
            path = self._path(dataset)
        except OSError:
            return None
        return str(path) if path.exists() else None

    # ---------- reading ----------

    def starts(self, path: str) -> List[int]:
        """First row of each batch of a copy, plus its row count. Every batch but the last has BROWSE_GROUP_ROWS rows."""
        with self._lock:
            if path in self._starts:
                return self._starts[path]
        with pa.memory_map(path) as source:
            reader = ipc.open_file(source, options=ipc.IpcReadOptions(included_fields=[0]))
            count = reader.num_record_batches
            last = reader.get_batch(count - 1).num_rows if count else 0
        size = BROWSE_GROUP_ROWS
        starts = [i * size for i in range(count)] + [max(count - 1, 0) * size + last]
        with self._lock:
            self._starts[path] = starts
        return starts

    def rows(self, path: str, offset: int, limit: int) -> pl.DataFrame:
        """Rows [offset, offset + limit) of a copy; recently read batches stay decoded."""
        starts = self.starts(path)
        end = min(offset + limit, starts[-1])
        parts = []
        position = offset
        while position < end:
            batch = bisect.bisect_right(starts, position) - 1
            frame = self._batch(path, batch)
            take = min(end, starts[batch + 1]) - position
            parts.append(frame.slice(position - starts[batch], take))
            position += take
        if not parts:
            return read_batches(path, [0]).head(0) if len(starts) > 1 else pl.DataFrame()
        return pl.concat(parts, how="vertical_relaxed") if len(parts) > 1 else parts[0]

    def _batch(self, path: str, batch: int) -> pl.DataFrame:
        key = (path, batch)
        with self._lock:
            if key in self._batches:
                self._batches.move_to_end(key)
                return self._batches[key]
        frame = read_batches(path, [batch])
        with self._lock:
            self._batches[key] = frame
            while len(self._batches) > CACHED_BATCHES:
                self._batches.popitem(last=False)
        return frame

    def _forget(self, prefix: str) -> None:
        with self._lock:
            for key in [k for k in self._starts if k.startswith(prefix)]:
                del self._starts[key]
            for key in [k for k in self._batches if k[0].startswith(prefix)]:
                del self._batches[key]

    # ---------- status ----------

    def needed(self, dataset: Dataset) -> bool:
        if dataset.format != DataFormat.PARQUET:
            return dataset.size_bytes >= SLOW_FILE_BYTES
        cache_key = f"{dataset.path}:{dataset.size_bytes}:{dataset.last_modified.isoformat()}"
        if cache_key not in self._needed:
            try:
                meta = pq.ParquetFile(dataset.path).metadata
                groups = (meta.row_group(i).total_byte_size for i in range(meta.num_row_groups))
                self._needed[cache_key] = any(size > SLOW_GROUP_BYTES for size in groups)
            except (OSError, pa.ArrowException):
                return False
        return self._needed[cache_key]

    def state(self, dataset: Dataset) -> str:
        """Copy state without measuring it: `not_needed` for files whose pages are fast anyway."""
        if self.ready_path(dataset):
            return "ready"
        job = self._jobs.get(dataset.id)
        if job:
            return "error" if job.error else "building"
        return "missing" if self.needed(dataset) else "not_needed"

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
        writer: Optional[Any] = None
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            for table in self._source_batches(dataset):
                if job.cancelled:
                    raise InterruptedError("cancelled")
                if writer is None:
                    writer = ipc.new_file(str(tmp), table.schema, options=ipc.IpcWriteOptions(compression="zstd"))
                writer.write_table(table, max_chunksize=BROWSE_GROUP_ROWS)
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
    def _source_batches(dataset: Dataset) -> Iterator[pa.Table]:
        """The source rows in tables of exactly BROWSE_GROUP_ROWS rows (the last may be shorter), read as a stream so
        memory stays flat."""
        pending: List[pa.Table] = []
        size = 0
        for batch in BrowseCopies._read_source(dataset):
            table = pa.Table.from_batches([batch]) if isinstance(batch, pa.RecordBatch) else batch
            pending.append(table)
            size += table.num_rows
            while size >= BROWSE_GROUP_ROWS:
                merged = pa.concat_tables(pending).combine_chunks() if len(pending) > 1 else pending[0]
                yield merged.slice(0, BROWSE_GROUP_ROWS)
                rest = merged.slice(BROWSE_GROUP_ROWS)
                pending, size = ([rest], rest.num_rows) if rest.num_rows else ([], 0)
        if size:
            yield pa.concat_tables(pending).combine_chunks() if len(pending) > 1 else pending[0]

    @staticmethod
    def _read_source(dataset: Dataset):
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
        existed = bool(job and not job.error) or (folder.exists() and any(folder.glob("*.arrow")))
        self._forget(str(folder))
        shutil.rmtree(folder, ignore_errors=True)
        return existed

    @staticmethod
    def _dataset(dataset_id: str) -> Dataset:
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise KeyError(f"Dataset {dataset_id} not found")
        return dataset


browse_copies = BrowseCopies()
