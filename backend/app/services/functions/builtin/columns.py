"""Column management and cleaning."""
import polars as pl

from app.services.functions.builtin.registry import P, builtin, target

CAST_TYPES = {
    "string": pl.String, "integer": pl.Int64, "float": pl.Float64,
    "boolean": pl.Boolean, "date": pl.Date, "datetime": pl.Datetime,
}
FILL_STRATEGIES = ["value", "forward", "backward", "mean", "median", "min", "max", "zero", "mode"]


@builtin(
    "select_columns", "Keep columns", "reshape", "Keep only the listed columns, in that order.",
    [P("columns", "columns")], "any", "only the listed columns", {"columns": ["text", "url"]},
)
def select_columns(lf, schema, p):
    return lf.select(p["columns"])


@builtin(
    "drop_columns", "Drop columns", "reshape", "Remove the listed columns.",
    [P("columns", "columns")], "any", "all other columns", {"columns": ["raw_html"]},
)
def drop_columns(lf, schema, p):
    return lf.drop(p["columns"])


@builtin(
    "rename_columns", "Rename columns", "reshape", "Rename columns using an {old: new} mapping.",
    [P("mapping", "mapping", "{old_name: new_name}")], "any", "same data, renamed columns", {"mapping": {"txt": "text"}},
)
def rename_columns(lf, schema, p):
    return lf.rename(p["mapping"])


@builtin(
    "cast_column", "Change type", "clean", "Convert a column to another type; unparsable values become null.",
    [P("column", "column"), P("dtype", "enum", options=list(CAST_TYPES)), P("new_column", "new_column", required=False)],
    "any column", "column converted to dtype", {"column": "price", "dtype": "float"},
)
def cast_column(lf, schema, p):
    dtype = CAST_TYPES[p["dtype"]]
    col = pl.col(p["column"])
    if schema[p["column"]] == pl.String and dtype in (pl.Date, pl.Datetime):
        expr = col.str.to_date(strict=False) if dtype == pl.Date else col.str.to_datetime(strict=False)
    else:
        expr = col.cast(dtype, strict=False)
    return lf.with_columns(expr.alias(target(p)))


@builtin(
    "fill_missing", "Fill missing values", "clean",
    "Fill nulls with a constant (strategy=value) or a statistic / neighbouring value.",
    [P("column", "column"), P("strategy", "enum", options=FILL_STRATEGIES, default="value"),
     P("value", "any", "Used when strategy=value", required=False)],
    "any column", "same column with nulls filled", {"column": "country", "strategy": "value", "value": "Unknown"},
)
def fill_missing(lf, schema, p):
    col, strategy = pl.col(p["column"]), p["strategy"]
    if strategy in ("forward", "backward", "mean", "min", "max", "zero"):
        expr = col.fill_null(strategy=strategy)
    elif strategy == "median":
        expr = col.fill_null(col.median())
    elif strategy == "mode":
        expr = col.fill_null(col.mode().first())
    else:
        expr = col.fill_null(pl.lit(p.get("value")))
    return lf.with_columns(expr)


@builtin(
    "replace_values", "Map values", "clean", "Replace exact values using an {old: new} mapping; other values are kept.",
    [P("column", "column"), P("mapping", "mapping"), P("new_column", "new_column", required=False)],
    "any column", "column with mapped values", {"column": "country", "mapping": {"USA": "United States"}},
)
def replace_values(lf, schema, p):
    return lf.with_columns(pl.col(p["column"]).replace(p["mapping"]).alias(target(p)))
