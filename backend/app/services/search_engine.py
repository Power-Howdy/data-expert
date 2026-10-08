"""Full-text search over rows.

Files under SCAN_LIMIT_BYTES are searched directly with Polars: always current (pending edits included), real value types.
Larger files are searched through a Tantivy index built in the background on first use. The index stores each row as
JSON, so hits are returned without reading the data file (which can't be read by row position quickly). It is keyed
by the file's size and modification time, so a changed file gets a fresh index.
"""
import gc
import json
import logging
import re
import shutil
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import polars as pl
import tantivy

from app.core.config import settings
from app.models.schemas import SearchIndexStatus, SearchRequest, SearchResponse, SearchResult
from app.services.changes import IDX
from app.services.data_loader import dataset_manager

logger = logging.getLogger(__name__)
SCAN_LIMIT_BYTES = 256 * 1024 * 1024
INDEX_VERSION = 2
BATCH_ROWS = 20_000
MAX_WRITER_HEAP = 512 * 1024 * 1024


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


def _highlights(data: Dict[str, Any], terms: List[str]) -> Dict[str, List[str]]:
    lowered = [t.lower() for t in terms]
    return {
        k: [v] for k, v in data.items()
        if isinstance(v, str) and any(t in v.lower() for t in lowered)
    }


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
        self._open: Dict[str, tantivy.Index] = {}
        self._lock = threading.RLock()

    # ---------- index files ----------

    @staticmethod
    def _key(path: str) -> str:
        stat = Path(path).stat()
        return f"v{INDEX_VERSION}-{stat.st_size}-{stat.st_mtime_ns}"

    def _dir(self, dataset_id: str, key: str) -> Path:
        return self.base / dataset_id / key

    @staticmethod
    def _schema() -> tantivy.Schema:
        builder = tantivy.SchemaBuilder()
        builder.add_unsigned_field("pos", stored=True)
        builder.add_text_field("text", stored=False)
        builder.add_text_field("row", stored=True, index_option="basic", tokenizer_name="raw")
        return builder.build()

    def _ready(self, dataset_id: str, key: str) -> bool:
        return (self._dir(dataset_id, key) / "dx-meta.json").exists()

    def _index(self, dataset_id: str, key: str) -> tantivy.Index:
        with self._lock:
            cache_key = f"{dataset_id}/{key}"
            if cache_key not in self._open:
                self._open[cache_key] = tantivy.Index.open(str(self._dir(dataset_id, key)))
            return self._open[cache_key]

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
                target=self._build, args=(dataset_id, self._key(dataset.path), job), daemon=True, name=f"index-{dataset_id}",
            )
            job.thread.start()
            return self.status(dataset_id)

    def _build(self, dataset_id: str, key: str, job: _Job) -> None:
        target = self._dir(dataset_id, key)
        tmp = target.with_name(key + ".tmp")
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir(parents=True)
        try:
            lf = dataset_manager.get_dataframe(dataset_id)
            schema = lf.collect_schema()
            frame = lf.select(
                row_text(schema, schema.names()).alias("text"), pl.struct(pl.all()).struct.json_encode().alias("row"),
            )
            index = tantivy.Index(self._schema(), str(tmp), reuse=False)
            heap = min(settings.performance.max_memory_usage_mb * 1024 * 1024, MAX_WRITER_HEAP)
            writer = index.writer(heap_size=heap)
            for batch in frame.collect_batches(chunk_size=BATCH_ROWS):
                for text, row in zip(batch["text"].to_list(), batch["row"].to_list()):
                    writer.add_document(tantivy.Document(pos=job.indexed, text=text or "", row=row))
                    job.indexed += 1
                if job.cancelled:
                    raise InterruptedError("cancelled")
            writer.commit()
            writer.wait_merging_threads()
            (tmp / "dx-meta.json").write_text(json.dumps({"version": INDEX_VERSION, "rows": job.indexed}))
            del writer, index
            gc.collect()
            tmp.rename(target)
            for old in target.parent.iterdir():
                if old != target:
                    shutil.rmtree(old, ignore_errors=True)
            with self._lock:
                if self._jobs.get(dataset_id) is job:
                    del self._jobs[dataset_id]
            logger.info(f"Search index for {dataset_id} built: {job.indexed} rows")
        except Exception as e:
            shutil.rmtree(tmp, ignore_errors=True)
            if not job.cancelled:
                logger.exception(f"Building the search index for {dataset_id} failed")
                job.error = str(e)

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
        results, total = self._index_search(dataset_id, self._key(dataset.path), request, terms, limit)
        return SearchResponse(results=results, total=total, took_ms=(time.time() - start) * 1000, mode="index", index=status)

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

    def _index_search(self, dataset_id: str, key: str, request: SearchRequest, terms: List[str], limit: int):
        from app.services.manipulation import manipulation_engine

        ops = manipulation_engine.pending_ops(dataset_id)
        if any(o["type"] == "transform" for o in ops):
            raise ValueError("Large files are searched as saved on disk; save or discard the pending transform first")
        deleted = {o["id"] for o in ops if o["type"] == "delete"}
        updates: Dict[int, Dict[str, Any]] = {}
        for o in ops:
            if o["type"] == "update":
                updates.setdefault(o["id"], {}).update(o["values"])

        index = self._index(dataset_id, key)
        searcher = index.searcher()
        query, _ = index.parse_query_lenient(request.query, ["text"], conjunction_by_default=True)
        found = searcher.search(query, limit=limit, offset=request.offset, count=True)
        if not found.hits and request.fuzzy:
            query, _ = index.parse_query_lenient(
                request.query, ["text"], fuzzy_fields={"text": (False, 1, True)}, conjunction_by_default=True,
            )
            found = searcher.search(query, limit=limit, offset=request.offset, count=True)

        results = []
        for score, address in found.hits:
            doc = searcher.doc(address)
            position = int(doc.get_first("pos"))
            if position in deleted:
                continue
            data = {**json.loads(doc.get_first("row")), **updates.get(position, {})}
            results.append(SearchResult(row_id=str(position), score=float(score), highlights=_highlights(data, terms), data=data))
        return results, found.count or 0

    def suggest(self, dataset_id: str, prefix: str, limit: int = 10) -> List[str]:
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset or not prefix:
            return []
        key = self._key(dataset.path)
        if not self._ready(dataset_id, key):
            return []
        searcher = self._index(dataset_id, key).searcher()
        return [term for term, _ in searcher.terms_with_prefix("text", prefix.lower(), limit=limit)]


search_engine = SearchEngine()
