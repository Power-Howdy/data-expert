"""Fast row pages for browsing a saved file: rows are read in windows, cached, and taken from Parquet with a streaming
reader where that is cheaper.

Polars decodes a Parquet column chunk completely before slicing it. Files written as one huge row group (common for
dataset dumps) therefore cost seconds per page even for the first rows. pyarrow's buffered reader decodes page by
page, so rows near the start of a row group, or right after the previous read, arrive in milliseconds. Windows far
into a row group are read with Polars, whose cost does not grow with the offset.

Open streaming readers hold the file open, which blocks replacing it on Windows: call `release(path)` first.
"""
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple

import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq

WINDOW_ROWS = 1000
MAX_WINDOWS = 24
MAX_CACHE_BYTES = 512 * 1024 * 1024
# Streaming decodes every row before the target; Polars decodes the whole row group at about a third of that cost
# per row. Stream while the rows to skip are under this fraction of the row group.
STREAM_FRACTION = 0.3
READER_IDLE_SECONDS = 20


def file_key(path: str) -> str:
    stat = Path(path).stat()
    return f"{Path(path).resolve()}:{stat.st_size}:{stat.st_mtime_ns}"


@dataclass
class _Reader:
    """A streaming reader positioned in one row group; `next_window` is the window its iterator yields next."""
    file: pq.ParquetFile
    group: int
    batches: Iterator[pa.RecordBatch]
    next_window: int = 0
    used: float = field(default_factory=time.monotonic)

    def close(self) -> None:
        self.batches = iter(())
        self.file.close()


class RowCache:
    def __init__(self) -> None:
        self._windows: "OrderedDict[Tuple[str, int, int], pl.DataFrame]" = OrderedDict()
        self._bytes = 0
        self._groups: Dict[str, List[int]] = {}
        self._readers: Dict[str, _Reader] = {}
        self._lock = threading.RLock()
        self._file_locks: Dict[str, threading.Lock] = {}

    # ---------- public ----------

    def rows(self, path: str, lf: pl.LazyFrame, parquet: bool, offset: int, limit: int, total: int) -> pl.DataFrame:
        """Rows [offset, offset + limit) of the file at `path`, whose lazy frame is `lf`."""
        key = file_key(path)
        end = min(offset + limit, total)
        groups = self._row_groups(key, path, parquet, total)
        parts, position = [], offset
        while position < end:
            group, group_start, group_rows = self._locate(groups, position)
            window = (position - group_start) // WINDOW_ROWS
            frame = self._window(key, path, lf, parquet, group, group_start, group_rows, window)
            start = group_start + window * WINDOW_ROWS
            take = min(end, start + frame.height) - position
            if take <= 0:
                break
            parts.append(frame.slice(position - start, take))
            position += take
        if not parts:
            return lf.head(0).collect()
        return pl.concat(parts, how="vertical_relaxed") if len(parts) > 1 else parts[0]

    def release(self, path: str) -> None:
        """Close streaming readers and forget cached rows of a file, e.g. before it is replaced."""
        prefix = f"{Path(path).resolve()}:"
        with self._lock:
            keys = [k for k in self._readers if k.startswith(prefix)]
        for key in keys:
            with self._file_lock(key), self._lock:
                reader = self._readers.pop(key, None)
                if reader:
                    reader.close()
        with self._lock:
            for key in [k for k in self._windows if k[0].startswith(prefix)]:
                self._bytes -= self._windows.pop(key).estimated_size()
            for key in [k for k in self._groups if k.startswith(prefix)]:
                del self._groups[key]

    # ---------- windows ----------

    def _window(self, key, path, lf, parquet, group, group_start, group_rows, window) -> pl.DataFrame:
        cache_key = (key, group, window)
        with self._lock:
            if cache_key in self._windows:
                self._windows.move_to_end(cache_key)
                return self._windows[cache_key]
        with self._file_lock(key):
            with self._lock:
                if cache_key in self._windows:
                    return self._windows[cache_key]
            skip = window * WINDOW_ROWS
            reader = self._readers.get(key)
            if parquet and reader and reader.group == group and reader.next_window <= window:
                skip = (window - reader.next_window) * WINDOW_ROWS
            if parquet and skip <= group_rows * STREAM_FRACTION:
                frame = self._stream(key, path, group, window)
            else:
                start = group_start + window * WINDOW_ROWS
                frame = lf.slice(start, min(WINDOW_ROWS, group_start + group_rows - start)).collect()
            self._store(cache_key, frame)
            return frame

    def _stream(self, key: str, path: str, group: int, window: int) -> pl.DataFrame:
        with self._lock:
            reader = self._readers.get(key)
        if not reader or reader.group != group or reader.next_window > window:
            if reader:
                reader.close()
            file = pq.ParquetFile(path, buffer_size=1 << 20, pre_buffer=False)
            reader = _Reader(file, group, file.iter_batches(batch_size=WINDOW_ROWS, row_groups=[group]))
            with self._lock:
                self._readers[key] = reader
        frame: Optional[pl.DataFrame] = None
        while reader.next_window <= window:
            batch = next(reader.batches, None)
            if batch is None:
                break
            current = reader.next_window
            reader.next_window += 1
            frame = pl.from_arrow(batch)
            if current < window:
                self._store((key, group, current), frame, keep=current >= window - 2)
        reader.used = time.monotonic()
        self._schedule_idle_close(key)
        return frame if frame is not None else pl.DataFrame()

    def _store(self, cache_key, frame: pl.DataFrame, keep: bool = True) -> None:
        if not keep:
            return
        with self._lock:
            if cache_key in self._windows:
                return
            self._windows[cache_key] = frame
            self._bytes += frame.estimated_size()
            while self._windows and (len(self._windows) > MAX_WINDOWS or self._bytes > MAX_CACHE_BYTES):
                _, dropped = self._windows.popitem(last=False)
                self._bytes -= dropped.estimated_size()

    # ---------- helpers ----------

    def _row_groups(self, key: str, path: str, parquet: bool, total: int) -> List[int]:
        with self._lock:
            if key in self._groups:
                return self._groups[key]
        sizes = [total]
        if parquet:
            meta = pq.ParquetFile(path).metadata
            sizes = [meta.row_group(i).num_rows for i in range(meta.num_row_groups)] or [0]
        with self._lock:
            self._groups[key] = sizes
        return sizes

    @staticmethod
    def _locate(groups: List[int], position: int) -> Tuple[int, int, int]:
        start = 0
        for index, rows in enumerate(groups):
            if position < start + rows:
                return index, start, rows
            start += rows
        return len(groups) - 1, start - groups[-1], groups[-1]

    def _file_lock(self, key: str) -> threading.Lock:
        with self._lock:
            return self._file_locks.setdefault(key, threading.Lock())

    def _schedule_idle_close(self, key: str) -> None:
        def close_if_idle() -> None:
            lock = self._file_lock(key)
            if not lock.acquire(blocking=False):
                return
            try:
                with self._lock:
                    reader = self._readers.get(key)
                    if reader and time.monotonic() - reader.used >= READER_IDLE_SECONDS:
                        self._readers.pop(key).close()
            finally:
                lock.release()

        timer = threading.Timer(READER_IDLE_SECONDS + 1, close_if_idle)
        timer.daemon = True
        timer.start()


row_cache = RowCache()
