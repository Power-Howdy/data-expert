"""Row selection: filtering, ordering, sampling, de-duplication."""
import polars as pl

from app.services.functions.builtin.registry import P, builtin
from app.services.functions.expressions import FILTER_OPERATORS, as_text, filter_expr


@builtin(
    "filter_rows", "Filter rows", "filter",
    "Keep rows where a column matches a condition. length_* counts characters (or list items), words_* counts words.",
    [P("column", "column"), P("operator", "enum", options=FILTER_OPERATORS),
     P("value", "any", "Comparison value; comma-separated for in/not_in", required=False)],
    "any column", "same columns, fewer rows",
    {"column": "token_count", "operator": "gt", "value": 10},
)
def filter_rows(lf, schema, p):
    return lf.filter(filter_expr(schema, p["column"], p["operator"], p.get("value")))


@builtin(
    "filter_range", "Filter by range", "filter", "Keep rows whose numeric/date column lies within [min, max].",
    [P("column", "column"), P("min", "number", required=False), P("max", "number", required=False)],
    "numeric or date column", "same columns, fewer rows", {"column": "price", "min": 10, "max": 100},
)
def filter_range(lf, schema, p):
    expr = pl.lit(True)
    if p.get("min") is not None:
        expr &= pl.col(p["column"]) >= p["min"]
    if p.get("max") is not None:
        expr &= pl.col(p["column"]) <= p["max"]
    return lf.filter(expr)


@builtin(
    "filter_keywords", "Filter by keywords", "filter",
    "Keep (or exclude) rows whose text contains any of the keywords.",
    [P("column", "column"), P("keywords", "list", "Words or phrases"),
     P("case_sensitive", "boolean", default=False), P("exclude", "boolean", "Drop matching rows instead", default=False)],
    "text column", "same columns, fewer rows", {"column": "text", "keywords": ["python", "sql"]},
)
def filter_keywords(lf, schema, p):
    text = as_text(schema, p["column"])
    words = [str(k) for k in p["keywords"]]
    if not p.get("case_sensitive"):
        text, words = text.str.to_lowercase(), [w.lower() for w in words]
    hit = text.str.contains_any(words)
    return lf.filter(~hit if p.get("exclude") else hit)


@builtin(
    "drop_nulls", "Drop empty rows", "clean", "Remove rows with missing values in the given columns (all columns if omitted).",
    [P("columns", "columns", required=False)], "any columns", "same columns, fewer rows", {"columns": ["email"]},
)
def drop_nulls(lf, schema, p):
    return lf.drop_nulls(subset=p.get("columns") or None)


@builtin(
    "dedupe", "Remove duplicates", "clean", "Remove duplicate rows, comparing only the given columns if provided.",
    [P("columns", "columns", required=False)], "any columns", "same columns, unique rows", {"columns": ["url"]},
)
def dedupe(lf, schema, p):
    return lf.unique(subset=p.get("columns") or None, maintain_order=True)


@builtin(
    "sort_rows", "Sort rows", "rank", "Sort by one or more columns; missing values go last.",
    [P("columns", "columns"), P("descending", "boolean", default=False)],
    "sortable columns", "same rows, reordered", {"columns": ["score"], "descending": True},
)
def sort_rows(lf, schema, p):
    return lf.sort(p["columns"], descending=bool(p.get("descending")), nulls_last=True)


@builtin(
    "top_n", "Top N rows", "rank", "Keep the N rows with the highest (or lowest) value of a column.",
    [P("column", "column"), P("n", "integer", default=10), P("descending", "boolean", "True = highest first", default=True)],
    "numeric or sortable column", "N rows, sorted", {"column": "score", "n": 10},
)
def top_n(lf, schema, p):
    return lf.sort(p["column"], descending=bool(p["descending"]), nulls_last=True).head(int(p["n"]))


@builtin(
    "limit_rows", "First N rows", "rank", "Keep the first N rows in the current order.",
    [P("n", "integer")], "any", "N rows", {"n": 100},
)
def limit_rows(lf, schema, p):
    return lf.head(int(p["n"]))


@builtin(
    "sample_rows", "Random sample", "rank", "Keep a reproducible random sample of N rows.",
    [P("n", "integer"), P("seed", "integer", default=42)], "any", "N random rows", {"n": 1000},
)
def sample_rows(lf, schema, p):
    rank = pl.int_range(pl.len()).shuffle(seed=int(p["seed"]))
    return lf.filter(rank < int(p["n"]))
