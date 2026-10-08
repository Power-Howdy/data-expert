"""Polars expression helpers shared by built-in functions, generated functions, filters and save-as."""
import warnings
from typing import Any, Callable, Dict

import polars as pl

# Polars suggests .cast(pl.String) for nested values, which it cannot actually do.
warnings.filterwarnings("ignore", category=pl.exceptions.PolarsInefficientMapWarning)

PRESET_PATTERNS = {
    "email": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    "phone": r"\+?\d[\d\s().-]{6,}\d",
    "url": r"https?://[^\s\"'<>)\]]+",
    "number": r"-?\d+(?:[.,]\d+)?",
    "hashtag": r"#\w+",
    "mention": r"@\w+",
    "date": r"\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b",
}

TEXT_OPERATORS = ["contains", "not_contains", "startswith", "endswith", "regex"]
SIZE_OPERATORS = [f"{p}{c}" for p in ("length_", "words_") for c in ("gt", "gte", "lt", "lte")]
FILTER_OPERATORS = [
    "eq", "ne", "gt", "gte", "lt", "lte", *TEXT_OPERATORS, "is_null", "is_not_null", "in", "not_in", *SIZE_OPERATORS,
]


def is_list(schema: pl.Schema, column: str) -> bool:
    return isinstance(schema[column], (pl.List, pl.Array))


def as_text(schema: pl.Schema, column: str) -> pl.Expr:
    """Column as a string expression; nested values become their text representation."""
    dtype = schema[column]
    if dtype == pl.String:
        return pl.col(column)
    if isinstance(dtype, (pl.Struct, pl.List, pl.Array)):
        return pl.col(column).map_elements(lambda v: str(v), return_dtype=pl.String)
    return pl.col(column).cast(pl.String)


def size_expr(schema: pl.Schema, column: str, words: bool) -> pl.Expr:
    if not words and is_list(schema, column):
        return pl.col(column).list.len()
    text = as_text(schema, column)
    return text.str.split(" ").list.len() if words else text.str.len_chars()


def typed(dtype: pl.DataType, value: Any) -> Any:
    """Coerce string input (from the filter UI or a model) to the column's type."""
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


def compare(expr: pl.Expr, cmp: str, value: Any) -> pl.Expr:
    ops: Dict[str, Callable[[], pl.Expr]] = {
        "eq": lambda: expr == value, "ne": lambda: expr != value,
        "gt": lambda: expr > value, "gte": lambda: expr >= value,
        "lt": lambda: expr < value, "lte": lambda: expr <= value,
    }
    if cmp not in ops:
        raise ValueError(f"Unknown operator: {cmp}")
    return ops[cmp]()


def filter_expr(schema: pl.Schema, column: str, operator: str, value: Any) -> pl.Expr:
    col = pl.col(column)
    if operator in TEXT_OPERATORS:
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
            return compare(size_expr(schema, column, words), operator[len(prefix):], float(value))
    if operator == "is_null":
        return col.is_null()
    if operator == "is_not_null":
        return col.is_not_null()
    if operator in ("in", "not_in"):
        values = value if isinstance(value, list) else [v.strip() for v in str(value).split(",")]
        values = [typed(schema[column], v) for v in values]
        return col.is_in(values) if operator == "in" else ~col.is_in(values)
    return compare(col, operator, typed(schema[column], value))
