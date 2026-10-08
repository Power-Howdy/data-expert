"""Enrichment computed locally. The model may choose parameters (e.g. topic keywords from samples) but never sees all rows."""
import polars as pl

from app.services.functions.builtin.registry import P, builtin
from app.services.functions.expressions import FILTER_OPERATORS, as_text, filter_expr


@builtin(
    "keyword_tag", "Tag by keywords", "enrich",
    "Label each row with categories (topics, sentiment, intent…) by matching keyword lists. "
    "Choose categories and keywords from the sample rows.",
    [P("column", "column"), P("new_column", "new_column"),
     P("categories", "mapping", "{label: [keywords]}"), P("default", "string", "Label when nothing matches", default="other"),
     P("multi", "boolean", "True = list of all matching labels", default=False)],
    "text column", "new str column (list[str] when multi=true)",
    {"column": "text", "new_column": "topic",
     "categories": {"sports": ["match", "goal", "team"], "finance": ["stock", "market", "bank"]}},
)
def keyword_tag(lf, schema, p):
    text = as_text(schema, p["column"]).str.to_lowercase()
    hits = {label: text.str.contains_any([str(k).lower() for k in kws]) for label, kws in p["categories"].items() if kws}
    if p["multi"]:
        labels = [pl.when(hit).then(pl.lit(label)) for label, hit in hits.items()]
        expr = pl.concat_list(labels).list.drop_nulls()
    else:
        expr = pl.lit(p["default"])
        for label, hit in reversed(list(hits.items())):
            expr = pl.when(hit).then(pl.lit(label)).otherwise(expr)
    return lf.with_columns(expr.alias(p["new_column"]))


@builtin(
    "keyword_score", "Score by keywords", "enrich",
    "Score rows by counting weighted keyword occurrences, e.g. relevance to a topic or a skill set.",
    [P("column", "column"), P("new_column", "new_column"), P("weights", "mapping", "{keyword: weight}")],
    "text column", "new float column", {"column": "text", "new_column": "relevance", "weights": {"python": 2, "sql": 1}},
)
def keyword_score(lf, schema, p):
    text = as_text(schema, p["column"]).str.to_lowercase()
    terms = [text.str.count_matches(str(k).lower(), literal=True).fill_null(0) * float(w) for k, w in p["weights"].items()]
    return lf.with_columns(pl.sum_horizontal(terms).cast(pl.Float64).alias(p["new_column"]))


@builtin(
    "weighted_score", "Weighted score", "rank", "Combine numeric columns into a score: sum of column × weight (nulls count as 0).",
    [P("weights", "mapping", "{column: weight}"), P("new_column", "new_column", default="score")],
    "numeric columns", "new float column", {"weights": {"rating": 1.0, "reviews": 0.01}, "new_column": "score"},
)
def weighted_score(lf, schema, p):
    missing = [c for c in p["weights"] if c not in schema]
    if missing:
        raise ValueError(f"unknown column(s): {', '.join(missing)}")
    terms = [pl.col(c).cast(pl.Float64, strict=False).fill_null(0) * float(w) for c, w in p["weights"].items()]
    return lf.with_columns(pl.sum_horizontal(terms).alias(p["new_column"]))


@builtin(
    "completeness_score", "Completeness score", "rank",
    "Score rows by how complete they are: share of non-empty columns plus a bonus for longer text. Good default for 'best rows'.",
    [P("columns", "columns", "Columns to consider (all if omitted)", required=False),
     P("new_column", "new_column", default="completeness")],
    "any columns", "new float column in [0, 2]", {"new_column": "completeness"},
)
def completeness_score(lf, schema, p):
    cols = p.get("columns") or list(schema.names())
    filled = [(pl.col(c).is_not_null() & (as_text(schema, c).str.len_chars() > 0)).cast(pl.Float64) for c in cols]
    length = pl.sum_horizontal([as_text(schema, c).str.len_chars().fill_null(0) for c in cols])
    bonus = (length.cast(pl.Float64) + 1).log10() / 6
    return lf.with_columns((pl.sum_horizontal(filled) / len(cols) + bonus.clip(upper_bound=1)).alias(p["new_column"]))


@builtin(
    "flag_rows", "Flag rows", "enrich", "Add a true/false column marking rows that match a condition.",
    [P("column", "column"), P("operator", "enum", options=FILTER_OPERATORS), P("value", "any", required=False),
     P("new_column", "new_column")],
    "any column", "new bool column", {"column": "text", "operator": "regex", "value": "(?i)urgent", "new_column": "is_urgent"},
)
def flag_rows(lf, schema, p):
    return lf.with_columns(filter_expr(schema, p["column"], p["operator"], p.get("value")).fill_null(False).alias(p["new_column"]))


@builtin(
    "bucketize", "Bucket numbers", "enrich", "Group a numeric column into labelled ranges using break points.",
    [P("column", "column"), P("breaks", "list", "Ascending break points"), P("new_column", "new_column"),
     P("labels", "list", "len(breaks)+1 labels", required=False)],
    "numeric column", "new str column", {"column": "age", "breaks": [18, 65], "labels": ["minor", "adult", "senior"], "new_column": "age_group"},
)
def bucketize(lf, schema, p):
    breaks = [float(b) for b in p["breaks"]]
    labels = [str(x) for x in p["labels"]] if p.get("labels") else None
    expr = pl.col(p["column"]).cast(pl.Float64, strict=False).cut(breaks, labels=labels).cast(pl.String)
    return lf.with_columns(expr.alias(p["new_column"]))
