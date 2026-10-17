"""Full-text search over rows.

Files under SCAN_LIMIT_BYTES are searched directly with Polars: always current (pending edits included), real value types.

Larger files are searched through a compact block index built in the background on first use. The rows are split into
blocks of at least MIN_BLOCK_ROWS; for each block the index keeps a BLOCK_BITS-bit fingerprint of the 2- and 3-byte
snippets in its lowercased text (a Bloom-style filter), plus a word list mapping each word to its blocks. A search
keeps only the blocks that can contain every query word, then scans those blocks for real matches, so results are
exactly those of a full scan. The index stays under 1/INDEX_RATIO of the data file. It is keyed by the file's size and
modification time, so a changed file gets a fresh index.

Blocks are scanned in parallel when the rows can be read at random: from the browse copy (Arrow batches, fastest) or a
Parquet file with small row groups. Only the columns that can contain a term are decoded; the rest are read for the
returned rows alone. Other files are streamed once, in order.
"""
import bisect
import gc
import json
import logging
import math
import re
import shutil
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple

import numpy as np
import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq

from app.core.config import settings
from app.models.schemas import DataFormat, Dataset, SearchIndexStatus, SearchRequest, SearchResponse, SearchResult
from app.services.browse_copy import browse_copies, read_batches
from app.services.changes import IDX
from app.services.data_loader import dataset_manager

logger = logging.getLogger(__name__)
SCAN_LIMIT_BYTES = 256 * 1024 * 1024
INDEX_VERSION = 5
BLOCK_BITS = 1 << 18
MIN_BLOCK_ROWS = 10_000
# Data per block, relative to its fingerprint: keeps the fingerprints under 1/800 of the file.
DATA_PER_FINGERPRINT = 800
# The whole index (fingerprints and word list) stays under 1/INDEX_RATIO of the file; a word list that would not
# fit is left out, and searches then rely on the fingerprints alone.
INDEX_RATIO = 100
WORD_PATTERN = r"\w+"
WORD_PART_BLOCKS = 20
BUILD_WORKERS = 3
SCAN_WORKERS = 16
OPEN_INDEXES = 2
# Once the requested page is filled, stop counting matches this long after the search started.
COUNT_BUDGET_S = 1.2
_POSITION = "__dx_position"
_HASH = np.uint64(2654435761)
_SHIFT = np.uint64(32 - int(math.log2(BLOCK_BITS)))


def _text_expr(name: str, dtype: pl.DataType) -> Optional[pl.Expr]:
    """A column's values as searchable text; nested values as JSON (without the column name)."""
    if dtype in (pl.Binary, pl.Object, pl.Null):
        return None
    if dtype.is_nested():
        prefix = len(json.dumps(name)) + 2
        return pl.struct(pl.col(name)).struct.json_encode().str.slice(prefix).str.strip_suffix("}")
    return pl.col(name).cast(pl.String)


def row_text(schema: pl.Schema, columns: List[str]) -> pl.Expr:
    exprs = [e for c in columns if (e := _text_expr(c, schema[c])) is not None]
    return pl.concat_str(exprs, separator="\n", ignore_nulls=True) if exprs else pl.lit("")


# Every character the text of a number or boolean (or a list of them, as JSON) can have, lowercased.
_NUMBER_TEXT = set("0123456789.-+e,[]") | set("null nan inf infinity true false")


def may_contain(dtype: pl.DataType, term: str) -> bool:
    """False when no value of this type can contain `term` as text: numbers, booleans and lists of them only spell
    digits, signs, exponents and words like `null`, `nan` and `true`."""
    if not term.isascii():
        return True
    inner = dtype
    while isinstance(inner, (pl.List, pl.Array)):
        inner = inner.inner
    if not (inner.is_numeric() or inner == pl.Boolean):
        return True
    return set(term.lower()) <= _NUMBER_TEXT


def term_columns(schema: pl.Schema, columns: List[str], term: str) -> List[str]:
    """The searchable columns that can contain `term`."""
    return [c for c in columns if _text_expr(c, schema[c]) is not None and may_contain(schema[c], term)]


def _highlights(data: Dict[str, Any], terms: List[str]) -> Dict[str, List[str]]:
    lowered = [t.lower() for t in terms]
    return {
        k: [v] for k, v in data.items()
        if isinstance(v, str) and any(t in v.lower() for t in lowered)
    }


# ---------- fingerprints ----------

def _hash(grams: np.ndarray) -> np.ndarray:
    return ((grams.astype(np.uint64) * _HASH) & np.uint64(0xFFFFFFFF)) >> _SHIFT


def block_signature(df: pl.DataFrame) -> Tuple[np.ndarray, pl.Series]:
    """A block's snippet fingerprint and its distinct lowercased words."""
    text = df.select(row_text(df.schema, df.columns).str.to_lowercase().str.join("\n")).item() or ""
    words = pl.Series("token", [text]).str.extract_all(WORD_PATTERN).explode().drop_nulls().unique()
    return block_fingerprint(text), words


def query_words(term: str) -> List[str]:
    """The word runs of a query term, split exactly as block text is split into words."""
    series = pl.Series([term]).str.to_lowercase().str.extract_all(WORD_PATTERN).explode().drop_nulls()
    return series.to_list()


def block_fingerprint(text: str) -> np.ndarray:
    """Bits of the 3-byte and 2-byte snippets in a block's lowercased text."""
    data = np.frombuffer(text.encode("utf-8") + b"\n\n", dtype=np.uint8)
    present = np.zeros(1 << 24, dtype=bool)
    step = 1 << 23
    for start in range(0, max(len(data) - 2, 0), step):
        b = data[start:start + step + 2].astype(np.uint32)
        present[(b[:-2] << 16) | (b[1:-1] << 8) | b[2:]] = True
    trigrams = np.flatnonzero(present).astype(np.uint64)
    bigrams = np.unique(trigrams >> np.uint64(8)) | np.uint64(1 << 24)
    bits = np.zeros(BLOCK_BITS, dtype=bool)
    bits[_hash(trigrams)] = True
    bits[_hash(bigrams)] = True
    return np.packbits(bits, bitorder="little")


def query_bits(term: str) -> np.ndarray:
    """Fingerprint bits a block must have to contain `term` (none for one-byte terms)."""
    b = np.frombuffer(term.lower().encode("utf-8"), dtype=np.uint8).astype(np.uint64)
    if len(b) >= 3:
        return _hash((b[:-2] << np.uint64(16)) | (b[1:-1] << np.uint64(8)) | b[2:])
    if len(b) == 2:
        return _hash(np.array([(1 << 24) | (int(b[0]) << 8) | int(b[1])], dtype=np.uint64))
    return np.array([], dtype=np.uint64)


# ---------- reading rows in blocks ----------

def _rebatch(frames: Iterable[pl.DataFrame], rows: int) -> Iterator[pl.DataFrame]:
    """Frames of exactly `rows` rows (the last may be shorter)."""
    buffer: List[pl.DataFrame] = []
    size = 0
    for frame in frames:
        buffer.append(frame)
        size += frame.height
        while size >= rows:
            merged = pl.concat(buffer, how="vertical_relaxed") if len(buffer) > 1 else buffer[0]
            yield merged.head(rows)
            rest = merged.slice(rows)
            buffer, size = ([rest], rest.height) if rest.height else ([], 0)
    if size:
        yield pl.concat(buffer, how="vertical_relaxed") if len(buffer) > 1 else buffer[0]


def _parquet_path(dataset: Dataset) -> Optional[str]:
    return dataset.path if dataset.format == DataFormat.PARQUET else None


def _all_rows(dataset: Dataset, batch_rows: int) -> Iterator[pl.DataFrame]:
    """Every row of the saved file, streamed in batches (from the browse copy when there is one)."""
    copy = browse_copies.ready_path(dataset)
    if copy:
        for batch in range(len(browse_copies.starts(copy)) - 1):
            yield read_batches(copy, [batch])
        return
    path = _parquet_path(dataset)
    if not path:
        yield from dataset_manager.get_dataframe(dataset.id).collect_batches(chunk_size=batch_rows)
        return
    file = pq.ParquetFile(path, buffer_size=1 << 20, pre_buffer=False)
    try:
        for batch in file.iter_batches(batch_size=batch_rows):
            yield pl.from_arrow(pa.Table.from_batches([batch]))
    finally:
        file.close()


class _Source:
    """Random access to row ranges of a file split into small groups: a browse copy (Arrow batches) or a Parquet file
    with small row groups."""

    def __init__(self, path: str, starts: List[int], arrow: bool):
        self.path, self.starts, self.arrow = path, starts, arrow

    def _groups(self, lo: int, hi: int) -> List[int]:
        first = bisect.bisect_right(self.starts, lo) - 1
        last = bisect.bisect_left(self.starts, hi)
        return list(range(max(first, 0), min(last, len(self.starts) - 1)))

    def read(self, groups: List[int], columns: Optional[List[str]] = None) -> pl.DataFrame:
        if self.arrow:
            return read_batches(self.path, groups, columns)
        file = pq.ParquetFile(self.path, buffer_size=1 << 20, pre_buffer=False)
        try:
            return pl.from_arrow(file.read_row_groups(groups, columns=columns, use_threads=False))
        finally:
            file.close()

    def range(self, lo: int, hi: int, columns: Optional[List[str]] = None) -> pl.DataFrame:
        groups = self._groups(lo, hi)
        return self.read(groups, columns).slice(lo - self.starts[groups[0]], hi - lo)

    def rows(self, positions: List[int], columns: List[str], pool: ThreadPoolExecutor) -> Dict[int, Dict[str, Any]]:
        """`columns` of the rows at `positions`, by position."""
        by_group: Dict[int, List[int]] = {}
        for p in positions:
            by_group.setdefault(bisect.bisect_right(self.starts, p) - 1, []).append(p)

        def read(group: int, wanted: List[int]) -> Dict[int, Dict[str, Any]]:
            frame = self.read([group], columns).gather([p - self.starts[group] for p in wanted])
            return dict(zip(wanted, frame.iter_rows(named=True)))

        rows: Dict[int, Dict[str, Any]] = {}
        for part in pool.map(lambda item: read(*item), by_group.items()):
            rows.update(part)
        return rows


def _source(dataset: Dataset, block_rows: int) -> Optional[_Source]:
    """Random access to the saved rows when the file allows it cheaply; None means it must be streamed."""
    copy = browse_copies.ready_path(dataset)
    if copy:
        return _Source(copy, browse_copies.starts(copy), arrow=True)
    path = _parquet_path(dataset)
    if path:
        starts = _group_starts(path)
        if max(b - a for a, b in zip(starts, starts[1:])) <= 4 * block_rows:
            return _Source(path, starts, arrow=False)
    return None


def _group_starts(path: str) -> List[int]:
    meta = pq.read_metadata(path)
    starts = [0]
    for g in range(meta.num_row_groups):
        starts.append(starts[-1] + meta.row_group(g).num_rows)
    return starts


def _sequential_ranges(dataset: Dataset, ranges: List[Tuple[int, int]]) -> Iterator[Tuple[int, pl.DataFrame]]:
    """The rows of each (start, end) range, in order, streaming the file and decoding only the row groups that hold them."""
    path = _parquet_path(dataset)
    if path:
        stream = _parquet_stream(path, ranges)
    else:
        stream = _positions(dataset_manager.get_dataframe(dataset.id).collect_batches(chunk_size=MIN_BLOCK_ROWS))
    pieces: List[pl.DataFrame] = []
    i = 0
    for pos, frame in stream:
        end = pos + frame.height
        while i < len(ranges):
            lo, hi = ranges[i]
            if lo < end and hi > pos:
                pieces.append(frame.slice(max(lo - pos, 0), min(hi, end) - max(lo, pos)))
            if hi > end:
                break
            if pieces:
                yield lo, pl.concat(pieces, how="vertical_relaxed") if len(pieces) > 1 else pieces[0]
            pieces = []
            i += 1
        if i == len(ranges):
            return


def _in_order(pool: ThreadPoolExecutor, tasks: Iterable, ahead: int) -> Iterator[Any]:
    """Results of `tasks` (callables) in order, running up to `ahead` of them at once."""
    pending: deque = deque()
    for task in tasks:
        pending.append(pool.submit(task))
        if len(pending) >= ahead:
            yield pending.popleft().result()
    while pending:
        yield pending.popleft().result()


def _positions(frames: Iterable[pl.DataFrame]) -> Iterator[Tuple[int, pl.DataFrame]]:
    pos = 0
    for frame in frames:
        yield pos, frame
        pos += frame.height


def _parquet_stream(path: str, ranges: List[Tuple[int, int]]) -> Iterator[Tuple[int, pl.DataFrame]]:
    file = pq.ParquetFile(path, buffer_size=1 << 20, pre_buffer=False)
    try:
        meta = file.metadata
        start = 0
        for g in range(meta.num_row_groups):
            rows = meta.row_group(g).num_rows
            wanted = [(lo, hi) for lo, hi in ranges if lo < start + rows and hi > start]
            if wanted:
                pos, last = start, max(hi for _, hi in wanted)
                for batch in file.iter_batches(batch_size=MIN_BLOCK_ROWS, row_groups=[g]):
                    end = pos + batch.num_rows
                    if any(lo < end and hi > pos for lo, hi in wanted):
                        yield pos, pl.from_arrow(pa.Table.from_batches([batch]))
                    pos = end
                    if pos >= last:
                        break
            start += rows
    finally:
        file.close()


class _Job:
    def __init__(self, total: int):
        self.total = total
        self.indexed = 0
        self.error: Optional[str] = None
        self.cancelled = False
        self.thread: Optional[threading.Thread] = None


class SearchEngine:
    def __init__(self, index_base_path: Optional[str] = None):
        self.base = Path(index_base_path or settings.search.index_path)
        self.base.mkdir(parents=True, exist_ok=True)
        self._jobs: Dict[str, _Job] = {}
        self._open: Dict[str, Tuple[Dict[str, Any], np.ndarray]] = {}
        self._lock = threading.RLock()
        self._remove_old_versions()

    # ---------- index files ----------

    @staticmethod
    def _key(path: str) -> str:
        stat = Path(path).stat()
        return f"v{INDEX_VERSION}-{stat.st_size}-{stat.st_mtime_ns}"

    def _dir(self, dataset_id: str, key: str) -> Path:
        return self.base / dataset_id / key

    def _remove_old_versions(self) -> None:
        for folder in self.base.glob("*/*"):
            if folder.is_dir() and not folder.name.startswith(f"v{INDEX_VERSION}-"):
                shutil.rmtree(folder, ignore_errors=True)

    def _ready(self, dataset_id: str, key: str) -> bool:
        return (self._dir(dataset_id, key) / "meta.json").exists()

    def _index(self, dataset_id: str, key: str) -> Tuple[Dict[str, Any], np.ndarray, Optional[pl.DataFrame]]:
        with self._lock:
            cache_key = f"{dataset_id}/{key}"
            if cache_key not in self._open:
                folder = self._dir(dataset_id, key)
                meta = json.loads((folder / "meta.json").read_text())
                bits = np.fromfile(folder / "blocks.bin", dtype=np.uint8).reshape(meta["blocks"], BLOCK_BITS // 8)
                words = pl.read_parquet(folder / "words.parquet") if (folder / "words.parquet").exists() else None
                while len(self._open) >= OPEN_INDEXES:
                    del self._open[next(iter(self._open))]
                self._open[cache_key] = (meta, bits, words)
            return self._open[cache_key]

    @staticmethod
    def block_rows(dataset: Dataset) -> int:
        """Rows per block: enough data that each fingerprint is under 1/DATA_PER_FINGERPRINT of it."""
        bytes_per_row = dataset.size_bytes / max(dataset.row_count, 1)
        rows = BLOCK_BITS // 8 * DATA_PER_FINGERPRINT / max(bytes_per_row, 1)
        return max(MIN_BLOCK_ROWS, math.ceil(rows / MIN_BLOCK_ROWS) * MIN_BLOCK_ROWS)

    # ---------- status & building ----------

    def status(self, dataset_id: str) -> SearchIndexStatus:
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise KeyError(f"Dataset {dataset_id} not found")
        key = self._key(dataset.path)
        if self._ready(dataset_id, key):
            folder = self._dir(dataset_id, key)
            size = sum(p.stat().st_size for p in folder.rglob("*") if p.is_file())
            return SearchIndexStatus(state="ready", indexed=dataset.row_count, total=dataset.row_count, size_bytes=size)
        job = self._jobs.get(dataset_id)
        if job and job.error:
            return SearchIndexStatus(state="error", indexed=job.indexed, total=job.total, error=job.error)
        if job:
            return SearchIndexStatus(state="building", indexed=job.indexed, total=job.total)
        return SearchIndexStatus(state="missing", total=dataset.row_count)

    def state(self, dataset: Dataset) -> str:
        """Index state without measuring it: `not_needed` for files searched by a direct scan."""
        if dataset.size_bytes < SCAN_LIMIT_BYTES:
            return "not_needed"
        job = self._jobs.get(dataset.id)
        if job:
            return "error" if job.error else "building"
        try:
            return "ready" if self._ready(dataset.id, self._key(dataset.path)) else "missing"
        except OSError:
            return "missing"

    def active(self) -> Dict[str, SearchIndexStatus]:
        """Indexes being built or that failed, by dataset id."""
        with self._lock:
            jobs = dict(self._jobs)
        return {
            dataset_id: SearchIndexStatus(
                state="error" if job.error else "building", indexed=job.indexed, total=job.total, error=job.error,
            )
            for dataset_id, job in jobs.items()
        }

    def build_index(self, dataset_id: str) -> SearchIndexStatus:
        """Start building the index in the background (no-op if it is ready or already building)."""
        with self._lock:
            current = self.status(dataset_id)
            if current.state in ("ready", "building"):
                return current
            dataset = dataset_manager.get_dataset(dataset_id)
            job = _Job(dataset.row_count)
            self._jobs[dataset_id] = job
            job.thread = threading.Thread(
                target=self._build, args=(dataset, self._key(dataset.path), job), daemon=True, name=f"index-{dataset_id}",
            )
            job.thread.start()
            return self.status(dataset_id)

    def _build(self, dataset: Dataset, key: str, job: _Job) -> None:
        target = self._dir(dataset.id, key)
        tmp = target.with_name(key + ".tmp")
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir(parents=True)
        rows = self.block_rows(dataset)
        try:
            blocks = 0
            words: List[pl.DataFrame] = []

            def flush_words() -> None:
                if words:
                    pl.concat(words).write_parquet(tmp / f"part-{blocks:08d}.parquet", compression="lz4")
                    words.clear()

            with open(tmp / "blocks.bin", "wb") as out, ThreadPoolExecutor(BUILD_WORKERS) as pool:
                pending: deque = deque()

                def write_next() -> None:
                    nonlocal blocks
                    future, height = pending.popleft()
                    bits, block_words = future.result()
                    out.write(bits.tobytes())
                    words.append(pl.DataFrame({"token": block_words, "block": pl.repeat(blocks, len(block_words), dtype=pl.UInt32, eager=True)}))
                    blocks += 1
                    job.indexed += height
                    if len(words) >= WORD_PART_BLOCKS:
                        flush_words()

                for block in _rebatch(_all_rows(dataset, MIN_BLOCK_ROWS), rows):
                    if job.cancelled:
                        raise InterruptedError("cancelled")
                    pending.append((pool.submit(block_signature, block), block.height))
                    while len(pending) >= BUILD_WORKERS:
                        write_next()
                while pending:
                    write_next()
            flush_words()
            has_words = self._write_words(tmp, dataset.size_bytes // INDEX_RATIO - (tmp / "blocks.bin").stat().st_size)
            meta = {"version": INDEX_VERSION, "rows": job.indexed, "block_rows": rows, "blocks": blocks, "words": has_words}
            (tmp / "meta.json").write_text(json.dumps(meta))
            tmp.rename(target)
            for old in target.parent.iterdir():
                if old != target:
                    shutil.rmtree(old, ignore_errors=True)
            with self._lock:
                if self._jobs.get(dataset.id) is job:
                    del self._jobs[dataset.id]
            logger.info(f"Search index for {dataset.name} built: {job.indexed} rows in {blocks} blocks")
        except Exception as e:
            shutil.rmtree(tmp, ignore_errors=True)
            if not job.cancelled:
                logger.exception(f"Building the search index for {dataset.name} failed")
                job.error = str(e) or type(e).__name__

    @staticmethod
    def _write_words(folder: Path, budget: int) -> bool:
        """Merge the per-block word parts into a sorted word list with the blocks of each word. Returns False (and
        writes nothing) when it would exceed `budget` bytes."""
        parts = sorted(folder.glob("part-*.parquet"))
        target = folder / "words.parquet"
        try:
            if not parts or budget <= 0:
                return False
            merged = pl.scan_parquet(parts).group_by("token").agg(pl.col("block").unique().sort()).sort("token")
            pq.write_table(
                merged.collect(engine="streaming").to_arrow(), target, compression="zstd", compression_level=9,
                use_dictionary=False,
                column_encoding={"token": "DELTA_BYTE_ARRAY", "block.list.element": "DELTA_BINARY_PACKED"},
            )
            if target.stat().st_size > budget:
                logger.info(f"Word list ({target.stat().st_size:,} bytes) exceeds the index budget; leaving it out")
                target.unlink()
                return False
            return True
        finally:
            for part in parts:
                part.unlink(missing_ok=True)

    def delete_index(self, dataset_id: str) -> None:
        """Stop any build and remove the dataset's indexes (call before and after replacing its file)."""
        with self._lock:
            job = self._jobs.pop(dataset_id, None)
            for cache_key in [k for k in self._open if k.startswith(f"{dataset_id}/")]:
                del self._open[cache_key]
        if job and job.thread and job.thread.is_alive():
            job.cancelled = True
            job.thread.join(timeout=60)
        gc.collect()
        shutil.rmtree(self.base / dataset_id, ignore_errors=True)

    # ---------- searching ----------

    def search(self, dataset_id: str, request: SearchRequest) -> SearchResponse:
        start = time.time()
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise KeyError(f"Dataset {dataset_id} not found")
        terms = request.query.split()
        if not terms:
            raise ValueError("Enter text to search for")
        limit = min(request.limit, settings.search.max_results)
        if dataset.size_bytes < SCAN_LIMIT_BYTES:
            results, total = self._scan(dataset_id, request, terms, limit)
            return SearchResponse(results=results, total=total, took_ms=(time.time() - start) * 1000)

        status = self.build_index(dataset_id)
        if status.state != "ready":
            return SearchResponse(results=[], total=0, took_ms=(time.time() - start) * 1000, mode="index", index=status)
        results, total, exact = self._index_search(dataset, self._key(dataset.path), request, terms, limit, start)
        return SearchResponse(
            results=results, total=total, total_exact=exact, took_ms=(time.time() - start) * 1000, mode="index", index=status,
        )

    def _scan(self, dataset_id: str, request: SearchRequest, terms: List[str], limit: int):
        from app.services.manipulation import manipulation_engine

        lf = manipulation_engine.frame(dataset_id)
        schema = lf.collect_schema()
        columns = [c for c in (request.columns or schema.names()) if c in schema and c != IDX]
        text = row_text(schema, columns)
        matched = lf.filter(pl.all_horizontal([text.str.contains(f"(?i){re.escape(t)}") for t in terms]))
        page = matched.slice(request.offset, limit).collect()
        total = matched.select(pl.len()).collect().item()
        results = []
        for row in page.iter_rows(named=True):
            row_id = row.pop(IDX)
            results.append(SearchResult(row_id=str(row_id), score=1.0, highlights=_highlights(row, terms), data=row))
        return results, total

    def candidate_blocks(self, dataset_id: str, key: str, terms: List[str]) -> Tuple[Dict[str, Any], List[int]]:
        """Blocks that can contain every term. A word run of a term can only occur inside a word of the text, so a
        block qualifies only if it has a word containing each run, and every snippet of each term."""
        meta, bits, words = self._index(dataset_id, key)
        keep = np.ones(meta["blocks"], dtype=bool)
        for term in terms:
            for h in query_bits(term):
                keep &= ((bits[:, int(h) >> 3] >> (int(h) & 7)) & 1).astype(bool)
            if words is None:
                continue
            for run in query_words(term):
                if not keep.any():
                    break
                found = words.filter(pl.col("token").str.contains(run, literal=True))["block"].explode().unique()
                has = np.zeros(meta["blocks"], dtype=bool)
                has[found.drop_nulls().to_numpy()] = True
                keep &= has
        return meta, np.flatnonzero(keep).tolist()

    def _index_search(self, dataset: Dataset, key: str, request: SearchRequest, terms: List[str], limit: int,
                      started: float):
        from app.services.manipulation import manipulation_engine

        ops = manipulation_engine.pending_ops(dataset.id)
        if any(o["type"] == "transform" for o in ops):
            raise ValueError("Large files are searched as saved on disk; save or discard the pending transform first")
        deleted = {o["id"] for o in ops if o["type"] == "delete"}
        updates: Dict[int, Dict[str, Any]] = {}
        for o in ops:
            if o["type"] == "update":
                updates.setdefault(o["id"], {}).update(o["values"])

        meta, blocks = self.candidate_blocks(dataset.id, key, terms)
        size = meta["block_rows"]
        blocks = sorted(set(blocks) | {i // size for i in updates if i // size < meta["blocks"]})
        ranges = [(b * size, min((b + 1) * size, meta["rows"])) for b in blocks]

        schema = dataset_manager.get_dataframe(dataset.id).collect_schema()
        everything = [c for c in schema.names() if c != IDX]
        names = [c for c in (request.columns or everything) if c in schema and c != IDX]
        needed = {c for t in terms for c in term_columns(schema, names, t)}
        keep = request.offset + limit

        def hits(lo: int, frame: pl.DataFrame):
            found = self._hits(frame, lo, names, terms, deleted, updates)
            return lo, found, list(frame.gather(found[:keep]).iter_rows(named=True)) if found else []

        # With random access, blocks are read in parallel, decoding only the columns that can match; the other
        # columns are fetched afterwards for the results alone.
        source = _source(dataset, size) if ranges else None
        columns = everything
        if source:
            columns = [c for c in everything if c in needed] or everything[:1]
            tasks = (lambda r=r: hits(r[0], source.range(*r, columns=columns)) for r in ranges)
        else:
            tasks = (lambda lo=lo, f=f: hits(lo, f) for lo, f in _sequential_ranges(dataset, ranges))

        picked: List[Tuple[int, Dict[str, Any]]] = []
        total = scanned = 0
        pool = ThreadPoolExecutor(SCAN_WORKERS)
        try:
            for lo, found, rows in _in_order(pool, tasks, SCAN_WORKERS + 2):
                scanned += 1
                first = max(request.offset - total, 0)
                count = max(min(limit - len(picked), len(found) - first), 0)
                picked.extend((lo + found[first + k], rows[first + k]) for k in range(count))
                total += len(found)
                if len(picked) >= limit and time.time() - started > COUNT_BUDGET_S:
                    break
        finally:
            pool.shutdown(wait=False, cancel_futures=True)
        missing = [c for c in everything if c not in columns]
        if source and picked and missing:
            with ThreadPoolExecutor(SCAN_WORKERS) as rows_pool:
                extra = source.rows([p for p, _ in picked], missing, rows_pool)
            picked = [(p, {**row, **extra[p]}) for p, row in picked]
        results = []
        for position, row in picked:
            data = {c: row.get(c) for c in everything}
            data.update(updates.get(position, {}))
            results.append(SearchResult(row_id=str(position), score=1.0, highlights=_highlights(data, terms), data=data))
        return results, total, scanned == len(ranges)

    @staticmethod
    def _hits(frame: pl.DataFrame, lo: int, names: List[str], terms: List[str],
              deleted: set, updates: Dict[int, Dict[str, Any]]) -> List[int]:
        """Indexes of the frame's rows that contain every term, with pending edits applied. Each term is matched
        column by column, skipping columns whose type cannot spell it; terms have no whitespace, so this equals
        matching the row's joined text. Longer (usually rarer) terms go first, and later terms only check the rows
        still left."""
        names = [c for c in names if c in frame.schema]
        found: set = set()
        exprs = []
        for t in sorted(terms, key=len, reverse=True):
            columns = term_columns(frame.schema, names, t)
            if not columns:
                exprs = []
                break
            pattern = f"(?i){re.escape(t)}"
            exprs.append(pl.any_horizontal([_text_expr(c, frame.schema[c]).str.contains(pattern) for c in columns]))
        if exprs and frame.height:
            left = frame.with_row_index(_POSITION)
            for expr in exprs:
                left = left.filter(expr.fill_null(False))
                if left.is_empty():
                    break
            found = set(left[_POSITION].to_list())
        lowered = [t.lower() for t in terms]
        for position, values in updates.items():
            i = position - lo
            if 0 <= i < frame.height:
                data = {**frame.row(i, named=True), **values}
                content = "\n".join(
                    json.dumps(v, default=str) if isinstance(v, (dict, list)) else str(v)
                    for k, v in data.items() if k in names and v is not None
                ).lower()
                found.discard(i)
                if all(t in content for t in lowered):
                    found.add(i)
        return sorted(i for i in found if lo + i not in deleted)


search_engine = SearchEngine()
