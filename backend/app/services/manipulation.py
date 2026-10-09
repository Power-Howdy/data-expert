"""Row browsing and editing. Edits are pending (kept in memory, applied lazily) until committed to the file."""
import logging
import threading
from typing import Any, Dict, List, Optional

import polars as pl

from app.models.ai_schemas import PlanStep, TransformPlan
from app.models.schemas import (
    ChangeItem, ChangesSummary, DataFormat, FilterParams, ReplaceRequest, RowData, RowsResponse, SortParams,
)
from app.services.browse_copy import browse_copies
from app.services.row_cache import row_cache
from app.models.version_schemas import VersionCommit
from app.services.changes import ADDED_BASE, IDX, apply_changes, coerce, replace_match, with_index
from app.services.data_loader import dataset_manager
from app.services.functions.expressions import filter_expr
from app.services.functions.library import function_library
from app.services.versioning.service import version_control

logger = logging.getLogger(__name__)
LABEL_CHARS = 60


def _short(value: Any) -> str:
    text = str(value)
    return text[:LABEL_CHARS] + "…" if len(text) > LABEL_CHARS else text


def _row_name(row_id: int) -> str:
    return "an added row" if row_id >= ADDED_BASE else f"row {row_id + 1:,}"


class DataManipulationEngine:
    def __init__(self):
        self._ops: Dict[str, List[Dict[str, Any]]] = {}
        self._added: Dict[str, int] = {}
        self._lock = threading.RLock()

    # ---------- reading ----------

    def _source(self, dataset_id: str) -> pl.LazyFrame:
        lf = dataset_manager.get_dataframe(dataset_id)
        if lf is None:
            raise ValueError(f"Dataset {dataset_id} not found")
        return lf

    def frame(self, dataset_id: str) -> pl.LazyFrame:
        """Current data including pending edits, with the IDX row-id column."""
        with self._lock:
            ops = list(self._ops.get(dataset_id, []))
        return apply_changes(self._source(dataset_id), ops) if ops else with_index(self._source(dataset_id))

    def pending_ops(self, dataset_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._ops.get(dataset_id, []))

    def has_changes(self, dataset_id: str) -> bool:
        return bool(self._ops.get(dataset_id))

    def get_rows(
        self, dataset_id: str, offset: int = 0, limit: int = 100,
        filters: Optional[List[FilterParams]] = None, sorts: Optional[List[SortParams]] = None,
    ) -> RowsResponse:
        if not filters and not sorts and not self.has_changes(dataset_id):
            dataset = dataset_manager.get_dataset(dataset_id)
            lf = self._source(dataset_id)
            total = dataset.row_count if dataset else lf.select(pl.len()).collect().item()
            df = self._saved_rows(dataset_id, offset, limit, total)
            rows = [RowData(id=str(offset + i), data=r) for i, r in enumerate(df.iter_rows(named=True))]
            return RowsResponse(rows=rows, total=total, offset=offset, limit=limit)

        lf = self.frame(dataset_id)
        schema = lf.collect_schema()
        for f in filters or []:
            lf = lf.filter(filter_expr(schema, f.column, f.operator, f.value))
        if sorts:
            lf = lf.sort([s.column for s in sorts], descending=[not s.ascending for s in sorts], nulls_last=True)
        total = lf.select(pl.len()).collect().item()
        df = lf.slice(offset, limit).collect()
        return RowsResponse(rows=[self._row(r) for r in df.iter_rows(named=True)], total=total, offset=offset, limit=limit)

    def _saved_rows(self, dataset_id: str, offset: int, limit: int, total: int) -> pl.DataFrame:
        """Rows of the file as saved (no pending edits), through the window cache."""
        lf = self._source(dataset_id)
        dataset = dataset_manager.get_dataset(dataset_id)
        if not dataset:
            return lf.slice(offset, limit).collect()
        copy = browse_copies.ready_path(dataset)
        if copy:
            return browse_copies.rows(copy, offset, limit)
        return row_cache.rows(dataset.path, lf, dataset.format == DataFormat.PARQUET, offset, limit, total)

    @staticmethod
    def _row(row: Dict[str, Any]) -> RowData:
        row_id = row.pop(IDX)
        return RowData(id=str(row_id), data=row)

    def get_row(self, dataset_id: str, row_id: str) -> RowData:
        position = self._parse_id(row_id)
        with self._lock:
            ops = list(self._ops.get(dataset_id, []))
        dataset = dataset_manager.get_dataset(dataset_id)
        if not ops and dataset and 0 <= position < dataset.row_count:
            df = self._saved_rows(dataset_id, position, 1, dataset.row_count)
            if df.height:
                return RowData(id=str(position), data=df.row(0, named=True))
        if position < ADDED_BASE and not any(o["type"] == "transform" for o in ops):
            lf = apply_changes(self._source(dataset_id).slice(position, 1), ops, offset=position)
        else:
            lf = self.frame(dataset_id)
        df = lf.filter(pl.col(IDX) == position).head(1).collect()
        if df.is_empty():
            raise KeyError(f"Row {row_id} not found")
        return self._row(df.row(0, named=True))

    @staticmethod
    def _parse_id(row_id: str) -> int:
        try:
            return int(row_id)
        except ValueError:
            raise ValueError(f"Invalid row id '{row_id}'")

    # ---------- editing ----------

    def _record(self, dataset_id: str, op: Dict[str, Any]) -> None:
        with self._lock:
            self._ops.setdefault(dataset_id, []).append(op)

    def _coerce_values(self, dataset_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        schema = self.frame(dataset_id).collect_schema()
        unknown = [k for k in data if k not in schema or k == IDX]
        if unknown:
            raise ValueError(f"Unknown column(s): {', '.join(unknown)}")
        return {k: coerce(v, schema[k], k) for k, v in data.items()}

    def add_row(self, dataset_id: str, data: Dict[str, Any]) -> RowData:
        values = self._coerce_values(dataset_id, data)
        with self._lock:
            row_id = ADDED_BASE + self._added.get(dataset_id, 0)
            self._added[dataset_id] = self._added.get(dataset_id, 0) + 1
        self._record(dataset_id, {"type": "add", "id": row_id, "values": values})
        return self.get_row(dataset_id, str(row_id))

    def update_row(self, dataset_id: str, row_id: str, data: Dict[str, Any]) -> RowData:
        current = self.get_row(dataset_id, row_id).data
        values = self._coerce_values(dataset_id, data)
        changed = {k: v for k, v in values.items() if current.get(k) != v}
        if changed:
            self._record(dataset_id, {"type": "update", "id": self._parse_id(row_id), "values": changed})
        return self.get_row(dataset_id, row_id)

    def delete_row(self, dataset_id: str, row_id: str) -> None:
        self.get_row(dataset_id, row_id)
        self._record(dataset_id, {"type": "delete", "id": self._parse_id(row_id)})

    def _replace_op(self, request: ReplaceRequest) -> Dict[str, Any]:
        if request.old_value in (None, "") and request.mode != "exact":
            raise ValueError("Enter text to find")
        return {
            "type": "replace", "column": request.column, "find": request.old_value, "replace": request.new_value,
            "mode": request.mode, "case_sensitive": request.case_sensitive,
        }

    def count_matches(self, dataset_id: str, request: ReplaceRequest) -> int:
        lf = self.frame(dataset_id)
        schema = lf.collect_schema()
        if request.column not in schema or request.column == IDX:
            raise ValueError(f"Unknown column '{request.column}'")
        return lf.filter(replace_match(schema, self._replace_op(request))).select(pl.len()).collect().item()

    def replace_values(self, dataset_id: str, request: ReplaceRequest) -> int:
        count = self.count_matches(dataset_id, request)
        if count:
            self._record(dataset_id, self._replace_op(request))
        return count

    def transform(self, dataset_id: str, operations: List[Dict[str, Any]], description: str = "") -> int:
        from app.services.ai.planner import TEST_ROWS, check_plan

        steps = [PlanStep(op=str(o.get("op") or o.get("function")), params=o.get("params") or {}) for o in operations]
        if not steps:
            raise ValueError("No operations given")
        check_plan(TransformPlan(steps=steps), self.frame(dataset_id).drop(IDX).head(TEST_ROWS).collect())
        self._record(dataset_id, {
            "type": "transform", "description": description,
            "steps": [s.model_dump(include={"op", "params"}) for s in steps],
            "functions": function_library.embed([s.op for s in steps]),
        })
        return len(steps)

    # ---------- pending changes ----------

    def summary(self, dataset_id: str) -> ChangesSummary:
        with self._lock:
            ops = list(self._ops.get(dataset_id, []))
        counts = {t: sum(1 for o in ops if o["type"] == t) for t in ("add", "update", "delete", "replace", "transform")}
        return ChangesSummary(
            total=len(ops), added=counts["add"], updated=counts["update"], deleted=counts["delete"],
            replaced=counts["replace"], transformed=counts["transform"], items=[self._describe(o) for o in ops],
        )

    @staticmethod
    def _describe(op: Dict[str, Any]) -> ChangeItem:
        kind = op["type"]
        if kind == "add":
            label = "Added a row"
        elif kind == "update":
            label = f"Edited {', '.join(op['values'])} in {_row_name(op['id'])}"
        elif kind == "delete":
            label = f"Deleted {_row_name(op['id'])}"
        elif kind == "replace":
            label = f"Replaced “{_short(op['find'])}” with “{_short(op['replace'])}” in {op['column']} ({op['mode']})"
        else:
            label = op.get("description") or "Transform: " + " → ".join(s["op"] for s in op["steps"])
        return ChangeItem(type=kind, label=label)

    def undo(self, dataset_id: str) -> bool:
        with self._lock:
            ops = self._ops.get(dataset_id)
            if not ops:
                return False
            ops.pop()
            return True

    def discard_changes(self, dataset_id: str) -> None:
        with self._lock:
            self._ops.pop(dataset_id, None)
            self._added.pop(dataset_id, None)

    def commit_changes(self, dataset_id: str, message: str = "") -> VersionCommit:
        """Write the edited data back to the dataset's file as a new version, then reload it under the same id."""
        if not dataset_manager.get_dataset(dataset_id):
            raise ValueError(f"Dataset {dataset_id} not found")
        if not self.has_changes(dataset_id):
            raise ValueError("There are no changes to save")
        with self._lock:
            ops = list(self._ops.get(dataset_id, []))
        summary = self.summary(dataset_id)
        labels = [i.label for i in summary.items]
        if not message.strip():
            message = labels[0] if len(labels) == 1 else f"{len(labels)} changes: " + "; ".join(labels[:3])
        commit = version_control.commit_edits(
            dataset_id, self.frame(dataset_id), ops, message.strip()[:500], labels,
            summary.model_dump(include={"added", "updated", "deleted", "replaced", "transformed"}),
        )
        self.discard_changes(dataset_id)
        return commit


manipulation_engine = DataManipulationEngine()
