"""Text extraction and normalisation."""
import polars as pl

from app.services.functions.builtin.registry import P, builtin, target
from app.services.functions.expressions import PRESET_PATTERNS, as_text, size_expr

TEXT_METRICS = ["length", "word_count", "line_count", "digit_count", "uppercase_ratio"]
TEXT_TRANSFORMS = [
    "lowercase", "uppercase", "strip", "title", "collapse_whitespace",
    "remove_punctuation", "remove_html", "remove_urls", "remove_emails",
]


@builtin(
    "extract_pattern", "Extract with pattern", "extract",
    "Extract matches of a preset (email, phone, url, number, hashtag, mention, date) or a custom regex.",
    [P("column", "column"), P("new_column", "new_column"),
     P("preset", "enum", options=list(PRESET_PATTERNS), required=False),
     P("pattern", "regex", "Custom regex, used when no preset", required=False),
     P("all", "boolean", "True = list of all matches, False = first match", default=True)],
    "text column (nested values are read as text)", "new list[str] column (or str when all=false)",
    {"column": "text", "new_column": "emails", "preset": "email"},
)
def extract_pattern(lf, schema, p):
    pattern = p.get("pattern") or PRESET_PATTERNS.get(p.get("preset") or "", "")
    if not pattern:
        raise ValueError("extract_pattern needs a preset or a pattern")
    text = as_text(schema, p["column"])
    expr = text.str.extract_all(pattern) if p["all"] else text.str.extract(pattern, 0)
    return lf.with_columns(expr.alias(p["new_column"]))


@builtin(
    "extract_field", "Extract nested field", "extract",
    "Pull a field out of a struct column or a JSON string using a dotted path like 'personal_info.email'.",
    [P("column", "column"), P("path", "string", "Dotted path inside the value"), P("new_column", "new_column")],
    "struct column or JSON text", "new column with the field value", {"column": "personal_info", "path": "email", "new_column": "email"},
)
def extract_field(lf, schema, p):
    keys = [k for k in str(p["path"]).split(".") if k]
    if isinstance(schema[p["column"]], pl.Struct):
        expr = pl.col(p["column"])
        for k in keys:
            expr = expr.struct.field(k)
    else:
        expr = as_text(schema, p["column"]).str.json_path_match("$." + ".".join(keys))
    return lf.with_columns(expr.alias(p["new_column"]))


@builtin(
    "text_metric", "Text metric", "transform", "Measure text: characters, words, lines, digits or uppercase ratio.",
    [P("column", "column"), P("metric", "enum", options=TEXT_METRICS), P("new_column", "new_column")],
    "text column", "new numeric column", {"column": "text", "metric": "word_count", "new_column": "words"},
)
def text_metric(lf, schema, p):
    text, metric = as_text(schema, p["column"]), p["metric"]
    expr = {
        "length": lambda: size_expr(schema, p["column"], False),
        "word_count": lambda: size_expr(schema, p["column"], True),
        "line_count": lambda: text.str.count_matches("\n") + 1,
        "digit_count": lambda: text.str.count_matches(r"\d"),
        "uppercase_ratio": lambda: text.str.count_matches(r"[A-Z]") / text.str.len_chars().clip(lower_bound=1),
    }[metric]()
    return lf.with_columns(expr.alias(p["new_column"]))


@builtin(
    "transform_text", "Clean text", "clean", "Normalise text: case, whitespace, punctuation, HTML, URLs or emails.",
    [P("column", "column"), P("operation", "enum", options=TEXT_TRANSFORMS), P("new_column", "new_column", required=False)],
    "text column", "cleaned text column", {"column": "text", "operation": "remove_html"},
)
def transform_text(lf, schema, p):
    text = as_text(schema, p["column"])
    expr = {
        "lowercase": lambda: text.str.to_lowercase(),
        "uppercase": lambda: text.str.to_uppercase(),
        "strip": lambda: text.str.strip_chars(),
        "title": lambda: text.str.to_titlecase(),
        "collapse_whitespace": lambda: text.str.replace_all(r"\s+", " ").str.strip_chars(),
        "remove_punctuation": lambda: text.str.replace_all(r"[^\w\s]", ""),
        "remove_html": lambda: text.str.replace_all(r"<[^>]+>", " "),
        "remove_urls": lambda: text.str.replace_all(PRESET_PATTERNS["url"], ""),
        "remove_emails": lambda: text.str.replace_all(PRESET_PATTERNS["email"], ""),
    }[p["operation"]]()
    return lf.with_columns(expr.alias(target(p)))


@builtin(
    "replace_text", "Find and replace", "clean", "Replace every occurrence of a literal string or regex.",
    [P("column", "column"), P("pattern", "string"), P("replacement", "string", default=""),
     P("literal", "boolean", "False = pattern is a regex", default=True), P("new_column", "new_column", required=False)],
    "text column", "text column with replacements", {"column": "text", "pattern": "N/A", "replacement": ""},
)
def replace_text(lf, schema, p):
    expr = as_text(schema, p["column"]).str.replace_all(p["pattern"], str(p["replacement"]), literal=bool(p["literal"]))
    return lf.with_columns(expr.alias(target(p)))


@builtin(
    "split_text", "Split text", "transform", "Split text into a list on a separator.",
    [P("column", "column"), P("separator", "string", default=","), P("new_column", "new_column")],
    "text column", "new list[str] column", {"column": "tags", "separator": ",", "new_column": "tag_list"},
)
def split_text(lf, schema, p):
    expr = as_text(schema, p["column"]).str.split(p["separator"]).list.eval(pl.element().str.strip_chars())
    return lf.with_columns(expr.alias(p["new_column"]))


@builtin(
    "concat_columns", "Join columns", "transform", "Join several columns into one text column.",
    [P("columns", "columns"), P("separator", "string", default=" "), P("new_column", "new_column")],
    "any columns", "new text column", {"columns": ["first", "last"], "new_column": "full_name"},
)
def concat_columns(lf, schema, p):
    parts = [as_text(schema, c).fill_null("") for c in p["columns"]]
    return lf.with_columns(pl.concat_str(parts, separator=p["separator"]).alias(p["new_column"]))
