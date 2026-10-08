from typing import Any, Callable, Dict, List

import polars as pl

PRESET_PATTERNS = {
    "email": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    "phone": r"\+?\d[\d\s().-]{6,}\d",
    "url": r"https?://[^\s\"'<>)\]]+",
    "number": r"-?\d+(?:[.,]\d+)?",
    "hashtag": r"#\w+",
    "mention": r"@\w+",
}

TEXT_OPS = {"contains", "not_contains", "startswith", "endswith", "regex"}


def _is_list(schema: pl.Schema, column: str) -> bool:
    return isinstance(schema[column], (pl.List, pl.Array))


def as_text(schema: pl.Schema, column: str) -> pl.Expr:
    """Column as a string expression; nested values become JSON."""
    dtype = schema[column]
    if dtype == pl.String:
        return pl.col(column)
    if isinstance(dtype, (pl.Struct, pl.List, pl.Array)):
        return pl.col(column).map_elements(lambda v: str(v), return_dtype=pl.String)
    return pl.col(column).cast(pl.String)


def _size(schema: pl.Schema, column: str, words: bool) -> pl.Expr:
    if not words and _is_list(schema, column):
        return pl.col(column).list.len()
    text = as_text(schema, column)
    return text.str.split(" ").list.len() if words else text.str.len_chars()


def filter_expr(schema: pl.Schema, column: str, operator: str, value: Any) -> pl.Expr:
    col = pl.col(column)
    if operator in TEXT_OPS:
        text, needle = as_text(schema, column), str(value)
        return {
            "contains": lambda: text.str.contains(needle, literal=True),
            "not_contains": lambda: ~text.str.contains(needle, literal=True),
            "startswith": lambda: text.str.starts_with(needle),
            "endswith": lambda: text.str.ends_with(needle),
            "regex": lambda: text.str.contains(needle),
        }[operator]()
    for prefix, words in (("length_", False), ("words_", True)):
        if operator.startswith(prefix):
            size, cmp = _size(schema, column, words), operator[len(prefix):]
            return _compare(size, cmp, float(value))
    if operator == "is_null":
        return col.is_null()
    if operator == "is_not_null":
        return col.is_not_null()
    if operator in ("in", "not_in"):
        values = value if isinstance(value, list) else [v.strip() for v in str(value).split(",")]
        values = [_typed(schema[column], v) for v in values]
        return col.is_in(values) if operator == "in" else ~col.is_in(values)
    return _compare(col, operator, _typed(schema[column], value))


def _typed(dtype: pl.DataType, value: Any) -> Any:
    """Coerce string input (from the filter UI) to the column's type."""
    if not isinstance(value, str):
        return value
    try:
        if dtype.is_integer():
            return int(float(value))
        if dtype.is_float():
            return float(value)
        if dtype == pl.Boolean:
            return value.strip().lower() in ("true", "1", "yes")
    except ValueError:
        pass
    return value


def _compare(expr: pl.Expr, cmp: str, value: Any) -> pl.Expr:
    ops: Dict[str, Callable[[], pl.Expr]] = {
        "eq": lambda: expr == value, "ne": lambda: expr != value,
        "gt": lambda: expr > value, "gte": lambda: expr >= value,
        "lt": lambda: expr < value, "lte": lambda: expr <= value,
    }
    if cmp not in ops:
        raise ValueError(f"Unknown filter operator: {cmp}")
    return ops[cmp]()


def _fill_null(lf: pl.LazyFrame, p: Dict[str, Any]) -> pl.LazyFrame:
    col, strategy = pl.col(p["column"]), p.get("strategy")
    if strategy in ("forward", "backward", "mean", "min", "max", "zero"):
        return lf.with_columns(col.fill_null(strategy=strategy))
    if strategy == "median":
        return lf.with_columns(col.fill_null(col.median()))
    return lf.with_columns(col.fill_null(pl.lit(p.get("value"))))


def _extract(lf: pl.LazyFrame, schema: pl.Schema, p: Dict[str, Any]) -> pl.LazyFrame:
    pattern = p.get("pattern") or PRESET_PATTERNS.get(p.get("preset", ""), "")
    if not pattern:
        raise ValueError("extract needs a preset or a pattern")
    text = as_text(schema, p["column"])
    expr = text.str.extract_all(pattern) if p.get("all", True) else text.str.extract(pattern, 0)
    return lf.with_columns(expr.alias(p["new_column"]))


DERIVE = {
    "length": lambda s, c: _size(s, c, False),
    "word_count": lambda s, c: _size(s, c, True),
    "lowercase": lambda s, c: as_text(s, c).str.to_lowercase(),
    "uppercase": lambda s, c: as_text(s, c).str.to_uppercase(),
    "strip": lambda s, c: as_text(s, c).str.strip_chars(),
}


def apply_operation(lf: pl.LazyFrame, op: str, p: Dict[str, Any]) -> pl.LazyFrame:
    schema = lf.collect_schema()
    if op == "filter":
        return lf.filter(filter_expr(schema, p["column"], p["operator"], p.get("value")))
    if op == "sort":
        return lf.sort(p["column"], descending=bool(p.get("descending", False)), nulls_last=True)
    if op == "limit":
        return lf.head(int(p["n"]))
    if op == "sample":
        n, seed = int(p["n"]), int(p.get("seed", 42))
        rank = pl.int_range(pl.len()).shuffle(seed=seed)
        return lf.filter(rank < n)
    if op == "select":
        return lf.select(p["columns"])
    if op == "drop":
        return lf.drop(p["columns"])
    if op == "rename":
        return lf.rename(p["mapping"])
    if op == "dedupe":
        return lf.unique(subset=p.get("columns") or None, maintain_order=True)
    if op == "extract":
        return _extract(lf, schema, p)
    if op == "derive":
        fn = DERIVE.get(p.get("function", ""))
        if not fn:
            raise ValueError(f"Unknown derive function: {p.get('function')}")
        return lf.with_columns(fn(schema, p["column"]).alias(p["new_column"]))
    if op == "fill_null":
        return _fill_null(lf, p)
    raise ValueError(f"Unknown operation: {op}")


def step_columns(op: str, p: Dict[str, Any]) -> List[str]:
    """Columns a step reads, for validation."""
    if op in ("filter", "sort", "extract", "derive", "fill_null"):
        return [p.get("column", "")]
    if op in ("select", "drop"):
        return list(p.get("columns", []))
    if op == "rename":
        return list(p.get("mapping", {}).keys())
    if op == "dedupe":
        return list(p.get("columns") or [])
    if op == "ai_column":
        return list(p.get("columns", []))
    return []
