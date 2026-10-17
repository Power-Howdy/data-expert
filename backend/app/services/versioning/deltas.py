"""Reverse deltas for row edits: rebuild a parent version from its child without keeping a copy of the parent.

A row-edit commit keeps parent rows in order, drops some, changes some cells and appends added rows at the end.
So the parent is: the child minus the appended rows, with old cell values put back and deleted rows merged in.
"""
from typing import Any, Dict, List, Optional, Tuple

import polars as pl

from app.services.changes import ADDED_BASE, IDX, NEW_SUFFIX, SET_PREFIX

OLD_SUFFIX = "__dx_old"
POS = "__dx_pos"


def build_undo(
    parent: pl.LazyFrame, child: pl.LazyFrame, touched: List[str],
) -> Tuple[Optional[pl.DataFrame], Optional[pl.DataFrame], Dict[str, Any]]:
    """Deleted parent rows, old values of changed cells, and counts. Both frames carry the IDX row-id column."""
    survivors = child.filter(pl.col(IDX) < ADDED_BASE).select(IDX)
    deleted = parent.join(survivors, on=IDX, how="anti").sort(IDX).collect()
    added = child.filter(pl.col(IDX) >= ADDED_BASE).select(pl.len()).collect().item()
    parent_rows = parent.select(pl.len()).collect().item()

    cells = None
    if touched:
        new = child.filter(pl.col(IDX) < ADDED_BASE).select([IDX] + [pl.col(c).alias(c + NEW_SUFFIX) for c in touched])
        flags = [pl.col(c).ne_missing(pl.col(c + NEW_SUFFIX)).alias(SET_PREFIX + c) for c in touched]
        cells = (
            parent.select([IDX] + touched).join(new, on=IDX, how="inner")
            .with_columns(flags).filter(pl.any_horizontal([SET_PREFIX + c for c in touched]))
            .select([IDX] + touched + [SET_PREFIX + c for c in touched]).sort(IDX).collect()
        )
    meta = {
        "parent_rows": parent_rows, "added": added, "deleted": deleted.height,
        "changed_rows": cells.height if cells is not None else 0, "columns": touched,
    }
    return (deleted if deleted.height else None), (cells if cells is not None and cells.height else None), meta


def apply_undo(
    child: pl.LazyFrame, meta: Dict[str, Any], deleted: Optional[pl.DataFrame], cells: Optional[pl.DataFrame],
) -> pl.LazyFrame:
    """The parent version, given the child version (without IDX) and the commit's reverse delta."""
    columns = child.collect_schema().names()
    lf = child.head(meta["parent_rows"] - meta["deleted"]).with_row_index(POS).with_columns(pl.col(POS).cast(pl.Int64))
    if deleted is not None:
        positions = deleted[IDX].cast(pl.Int64)
        keys = (positions - pl.int_range(len(positions), eager=True, dtype=pl.Int64)).alias("keys")
        lf = lf.with_columns((pl.col(POS) + pl.lit(keys).search_sorted(pl.col(POS), side="right").cast(pl.Int64)).alias(IDX))
    else:
        lf = lf.with_columns(pl.col(POS).alias(IDX))
    lf = lf.drop(POS)

    if cells is not None:
        touched = [c for c in meta["columns"] if c in columns]
        old = cells.lazy().select([IDX] + [pl.col(c).alias(c + OLD_SUFFIX) for c in touched] + [SET_PREFIX + c for c in touched])
        lf = lf.join(old, on=IDX, how="left", maintain_order="left").with_columns([
            pl.when(pl.col(SET_PREFIX + c).fill_null(False)).then(pl.col(c + OLD_SUFFIX)).otherwise(pl.col(c)).alias(c)
            for c in touched
        ]).select([IDX] + columns)

    if deleted is not None:
        schema = lf.collect_schema()
        back = deleted.lazy().select([pl.col(name).cast(dtype) for name, dtype in schema.items()])
        lf = lf.merge_sorted(back, key=IDX)
    return lf.drop(IDX)
