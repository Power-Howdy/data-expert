"""Changing the shape of the table: nesting and aggregation."""
import polars as pl

from app.services.functions.builtin.registry import P, builtin

AGGREGATES = ["count", "sum", "mean", "median", "min", "max", "n_unique", "first", "list"]


@builtin(
    "explode_list", "One row per list item", "reshape", "Turn a list column into one row per item.",
    [P("column", "column")], "list column", "more rows; column holds single items", {"column": "emails"},
)
def explode_list(lf, schema, p):
    return lf.explode(p["column"])


@builtin(
    "unnest_struct", "Expand nested fields", "reshape", "Expand a struct column into one column per field.",
    [P("column", "column")], "struct column",
    "struct replaced by its fields (prefixed with the column name when a name is taken)", {"column": "personal_info"},
)
def unnest_struct(lf, schema, p):
    column = p["column"]
    if not isinstance(schema[column], pl.Struct):
        raise ValueError(f"'{column}' is not a struct column")
    taken = set(schema.names()) - {column}
    fields = [
        pl.col(column).struct.field(f.name).alias(f"{column}_{f.name}" if f.name in taken else f.name)
        for f in schema[column].fields
    ]
    return lf.with_columns(fields).drop(column)


@builtin(
    "group_aggregate", "Group and aggregate", "aggregate",
    "Group rows by columns and aggregate another column (count ignores the value column).",
    [P("by", "columns"), P("agg", "enum", options=AGGREGATES, default="count"),
     P("column", "column", "Value column (not needed for count)", required=False),
     P("new_column", "new_column", required=False)],
    "any columns", "one row per group", {"by": ["country"], "agg": "count"},
)
def group_aggregate(lf, schema, p):
    agg = p["agg"]
    if agg == "count":
        expr = pl.len().alias(p.get("new_column") or "count")
    else:
        if not p.get("column"):
            raise ValueError(f"'{agg}' needs a value column")
        col = pl.col(p["column"])
        expr = getattr(col, "implode" if agg == "list" else agg)().alias(p.get("new_column") or f"{p['column']}_{agg}")
    return lf.group_by(p["by"], maintain_order=True).agg(expr)


@builtin(
    "value_counts", "Count values", "aggregate", "Count how often each value of a column occurs, most common first.",
    [P("column", "column"), P("top", "integer", "Keep the top N values", required=False)],
    "any column", "two columns: value and count", {"column": "country", "top": 20},
)
def value_counts(lf, schema, p):
    out = lf.group_by(p["column"]).agg(pl.len().alias("count")).sort("count", descending=True)
    return out.head(int(p["top"])) if p.get("top") else out
