"""Pending edits applied lazily on top of a dataset, so large files are never loaded just to show or save an edit.

Rows are identified by their position in the source file (column IDX). Added rows get ids from ADDED_BASE upwards.
A transform renumbers rows, because it may reorder, drop or aggregate them.
"""
import re
from typing import Any, Dict, List, Set

import polars as pl

from app.services.functions.expressions import typed
from app.services.functions.library import function_library

IDX = "__dx_row"
ADDED_BASE = 1 << 40
SET_PREFIX = "__dx_set_"
NEW_SUFFIX = "__dx_new"
REPLACE_MODES = ("exact", "contains", "regex")


def with_index(lf: pl.LazyFrame, offset: int = 0) -> pl.LazyFrame:
    return lf.with_row_index(IDX, offset=offset).with_columns(pl.col(IDX).cast(pl.Int64))


def coerce(value: Any, dtype: pl.DataType, column: str) -> Any:
    """Convert an edited value to the column type, or raise a readable error."""
    if value is None:
        return None
    temporal = dtype == pl.Date or dtype == pl.Time or isinstance(dtype, pl.Datetime)
    if isinstance(value, str) and temporal:
        text = pl.Series([value]).str
        parsed = text.to_date(strict=False) if dtype == pl.Date else (
            text.to_time(strict=False) if dtype == pl.Time else text.to_datetime(strict=False)
        )
        series = parsed.cast(dtype, strict=False)
    else:
        series = pl.Series([value], dtype=dtype, strict=False)
        if series.null_count():
            series = pl.Series([value]).cast(dtype, strict=False)
    if series.null_count():
        raise ValueError(f"'{value}' is not a valid {dtype} for column '{column}'")
    return series.to_list()[0]


def _flush(lf: pl.LazyFrame, updates: Dict[int, Dict[str, Any]], deletes: Set[int]) -> pl.LazyFrame:
    if deletes:
        lf = lf.filter(~pl.col(IDX).is_in(list(deletes)))
    if not updates:
        return lf
    schema = lf.collect_schema()
    ids = list(updates)
    columns = sorted({c for values in updates.values() for c in values})
    data: Dict[str, List[Any]] = {IDX: ids}
    types: Dict[str, pl.DataType] = {IDX: pl.Int64}
    for c in columns:
        data[c + NEW_SUFFIX], types[c + NEW_SUFFIX] = [updates[i].get(c) for i in ids], schema[c]
        data[SET_PREFIX + c], types[SET_PREFIX + c] = [c in updates[i] for i in ids], pl.Boolean
    right = pl.DataFrame(data, schema=types, strict=False).lazy()
    lf = lf.join(right, on=IDX, how="left", maintain_order="left")
    lf = lf.with_columns([
        pl.when(pl.col(SET_PREFIX + c).fill_null(False)).then(pl.col(c + NEW_SUFFIX)).otherwise(pl.col(c)).alias(c)
        for c in columns
    ])
    return lf.drop([c + NEW_SUFFIX for c in columns] + [SET_PREFIX + c for c in columns])


def _add(lf: pl.LazyFrame, op: Dict[str, Any]) -> pl.LazyFrame:
    schema = lf.collect_schema()
    row = {name: [op["values"].get(name)] for name in schema.names() if name != IDX}
    row[IDX] = [op["id"]]
    new = pl.DataFrame(row, schema=schema, strict=False).lazy()
    return pl.concat([lf, new.select(schema.names())], how="vertical")


def replace_match(schema: pl.Schema, op: Dict[str, Any]) -> pl.Expr:
    column, find, mode = op["column"], op["find"], op.get("mode", "exact")
    insensitive = not op.get("case_sensitive", True)
    if mode == "exact" and schema[column] != pl.String:
        return pl.col(column) == typed(schema[column], find)
    if schema[column] != pl.String:
        raise ValueError(f"'{mode}' replace works on text columns; '{column}' is {schema[column].base_type()}")
    text = pl.col(column)
    if mode == "exact":
        return text.str.to_lowercase() == str(find).lower() if insensitive else text == str(find)
    pattern = re.escape(str(find)) if mode == "contains" else str(find)
    return text.str.contains(f"(?i){pattern}" if insensitive else pattern)


def _replace(lf: pl.LazyFrame, op: Dict[str, Any]) -> pl.LazyFrame:
    schema = lf.collect_schema()
    column, mode, new = op["column"], op.get("mode", "exact"), op["replace"]
    if mode == "exact":
        value = coerce(new, schema[column], column) if new is not None else None
        expr = pl.when(replace_match(schema, op)).then(pl.lit(value, dtype=schema[column])).otherwise(pl.col(column))
    elif mode == "contains" and op.get("case_sensitive", True):
        replace_match(schema, op)
        expr = pl.col(column).str.replace_all(str(op["find"]), str(new or ""), literal=True)
    else:
        replace_match(schema, op)
        literal = mode == "contains"
        pattern = re.escape(str(op["find"])) if literal else str(op["find"])
        if not op.get("case_sensitive", True):
            pattern = f"(?i){pattern}"
        replacement = str(new or "").replace("$", "$$") if literal else str(new or "")
        expr = pl.col(column).str.replace_all(pattern, replacement)
    return lf.with_columns(expr.alias(column))


def _transform(lf: pl.LazyFrame, op: Dict[str, Any]) -> pl.LazyFrame:
    lf = lf.drop(IDX)
    for step in op["steps"]:
        lf = function_library.apply(lf, step["op"], step.get("params", {}), op.get("functions"))
    return with_index(lf)


def apply_changes(lf: pl.LazyFrame, ops: List[Dict[str, Any]], offset: int = 0) -> pl.LazyFrame:
    """The dataset with all pending ops applied, plus an IDX column identifying each row.

    `offset` lets callers pass a slice of the source starting at that row (only valid without transforms).
    """
    lf = with_index(lf, offset)
    updates: Dict[int, Dict[str, Any]] = {}
    deletes: Set[int] = set()
    for op in ops:
        kind = op["type"]
        if kind == "update":
            if op["id"] not in deletes:
                updates.setdefault(op["id"], {}).update(op["values"])
            continue
        if kind == "delete":
            deletes.add(op["id"])
            updates.pop(op["id"], None)
            continue
        lf, updates, deletes = _flush(lf, updates, deletes), {}, set()
        lf = {"add": _add, "replace": _replace, "transform": _transform}[kind](lf, op)
    return _flush(lf, updates, deletes)
