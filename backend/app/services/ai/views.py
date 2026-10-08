import json
import threading
import uuid
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

import polars as pl

from app.models.ai_schemas import PlanStep, ViewInfo
from app.models.schemas import FilterParams
from app.services.ai.operations import filter_expr
from app.services.data_loader import dataset_manager, data_loader

MAX_VIEWS = 50
WINDOW_ROWS = 1000
MAX_CACHED_WINDOWS = 12


class ViewStore:
    """Transient derived datasets (results of AI pipelines) kept in memory until saved or discarded."""

    def __init__(self):
        self._views: Dict[str, Tuple[ViewInfo, pl.LazyFrame]] = {}
        self._lock = threading.Lock()
        self._windows: "OrderedDict[Tuple[str, str, int], Tuple[int, pl.DataFrame]]" = OrderedDict()

    def page(self, view_id: str, offset: int, limit: int, filters: List[FilterParams]) -> Tuple[int, List[Dict[str, Any]]]:
        """Rows of a view, fetched in cached windows: filtered scans of large files cost the same for 100 or 1000 rows."""
        info, lf = self.get(view_id)
        key = json.dumps([f.model_dump() for f in filters], default=str)
        if filters:
            schema = lf.collect_schema()
            for f in filters:
                lf = lf.filter(filter_expr(schema, f.column, f.operator, f.value))
        rows: List[Dict[str, Any]] = []
        total = info.total if not filters else None
        start = (offset // WINDOW_ROWS) * WINDOW_ROWS
        while len(rows) < limit:
            total_w, window = self._window(view_id, key, start, lf)
            total = total_w if total is None else total
            rows += window.slice(max(0, offset - start), limit - len(rows)).to_dicts()
            if window.height < WINDOW_ROWS:
                break
            start += WINDOW_ROWS
            offset = start
        return total, rows

    def _window(self, view_id: str, key: str, start: int, lf: pl.LazyFrame) -> Tuple[int, pl.DataFrame]:
        cache_key = (view_id, key, start)
        with self._lock:
            if cache_key in self._windows:
                self._windows.move_to_end(cache_key)
                return self._windows[cache_key]
        total = lf.select(pl.len()).collect().item()
        entry = (total, lf.slice(start, WINDOW_ROWS).collect())
        with self._lock:
            self._windows[cache_key] = entry
            while len(self._windows) > MAX_CACHED_WINDOWS:
                self._windows.popitem(last=False)
        return entry

    def base_frame(self, dataset_id: str, view_id: Optional[str] = None) -> pl.LazyFrame:
        if view_id:
            return self.get(view_id)[1]
        lf = dataset_manager.get_dataframe(dataset_id)
        if lf is None:
            raise ValueError(f"Dataset {dataset_id} not found")
        return lf

    def create(
        self, dataset_id: str, lf: pl.LazyFrame, prompt: str, steps: List[PlanStep],
        parent_view_id: Optional[str] = None, notes: Optional[List[str]] = None,
    ) -> ViewInfo:
        info = ViewInfo(
            id=str(uuid.uuid4()),
            dataset_id=dataset_id,
            parent_view_id=parent_view_id,
            prompt=prompt,
            steps=steps,
            schema=data_loader.get_schema(lf),
            total=lf.select(pl.len()).collect().item(),
            notes=notes or [],
        )
        with self._lock:
            self._views[info.id] = (info, lf)
            while len(self._views) > MAX_VIEWS:
                self._views.pop(next(iter(self._views)))
        return info

    def get(self, view_id: str) -> Tuple[ViewInfo, pl.LazyFrame]:
        with self._lock:
            entry = self._views.get(view_id)
        if not entry:
            raise ValueError("This AI result has expired. Run the prompt again.")
        return entry

    def delete(self, view_id: str) -> bool:
        with self._lock:
            for k in [k for k in self._windows if k[0] == view_id]:
                self._windows.pop(k)
            return self._views.pop(view_id, None) is not None

    def drop_dataset(self, dataset_id: str) -> None:
        with self._lock:
            ids = [v for v, (info, _) in self._views.items() if info.dataset_id == dataset_id]
        for vid in ids:
            self.delete(vid)


view_store = ViewStore()
