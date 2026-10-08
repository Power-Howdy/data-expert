"""Compile model-written functions under strict rules.

Generated code is AST-checked before it runs: no imports, no dunder access, no file/network IO and no eager
collection. This keeps model mistakes contained in a local single-user tool; it is not a hardened security boundary.
"""
import ast
import builtins
import json
import math
import re
from typing import Any, Callable, Dict

import polars as pl

from app.services.functions import expressions

ENTRY = "run"
DENIED_NAMES = {
    "eval", "exec", "compile", "open", "input", "globals", "locals", "vars", "getattr", "setattr", "delattr",
    "breakpoint", "help", "exit", "quit", "memoryview", "type", "object", "super", "classmethod", "staticmethod",
    "property", "dir", "id", "hash", "iter", "next", "print",
}
DENIED_ATTRS = {
    "format", "format_map", "Config", "SQLContext", "sql", "plugins", "register_plugin_function", "io", "api",
    "collect", "collect_async", "fetch", "profile", "show_graph", "to_pandas", "to_arrow", "sink", "system",
}
DENIED_ATTR_PREFIXES = ("_", "read_", "scan_", "write_", "sink_")
DENIED_NODES = (
    ast.Import, ast.ImportFrom, ast.Global, ast.Nonlocal, ast.ClassDef, ast.AsyncFunctionDef,
    ast.Await, ast.With, ast.AsyncWith, ast.AsyncFor, ast.Yield, ast.YieldFrom, ast.Delete,
)
SAFE_BUILTINS = {
    name: getattr(builtins, name) for name in (
        "abs", "all", "any", "bool", "dict", "enumerate", "filter", "float", "int", "isinstance", "len", "list",
        "map", "max", "min", "range", "reversed", "round", "set", "sorted", "str", "sum", "tuple", "zip",
        "ValueError", "KeyError", "TypeError", "Exception", "True", "False", "None",
    ) if hasattr(builtins, name)
}
HELPERS = {
    "pl": pl, "re": re, "math": math, "json": json,
    "as_text": expressions.as_text, "size_expr": expressions.size_expr,
    "filter_expr": expressions.filter_expr, "PRESET_PATTERNS": dict(expressions.PRESET_PATTERNS),
}


class SandboxError(ValueError):
    pass


def check_source(source: str) -> ast.Module:
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise SandboxError(f"Syntax error on line {e.lineno}: {e.msg}")
    for node in ast.walk(tree):
        if isinstance(node, DENIED_NODES):
            raise SandboxError(f"'{type(node).__name__}' is not allowed")
        if isinstance(node, ast.Name) and (node.id in DENIED_NAMES or node.id.startswith("_")):
            raise SandboxError(f"Name '{node.id}' is not allowed")
        if isinstance(node, ast.Attribute) and (
            node.attr in DENIED_ATTRS or node.attr.startswith(DENIED_ATTR_PREFIXES)
        ):
            raise SandboxError(f"Attribute '.{node.attr}' is not allowed")
    top = [n for n in tree.body if not (isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant))]
    if not any(isinstance(n, ast.FunctionDef) and n.name == ENTRY for n in top):
        raise SandboxError(f"Code must define `def {ENTRY}(lf, params):`")
    if any(not isinstance(n, (ast.FunctionDef, ast.Assign)) for n in top):
        raise SandboxError("Only function definitions and constants are allowed at the top level")
    return tree


def compile_function(source: str) -> Callable[[pl.LazyFrame, Dict[str, Any]], pl.LazyFrame]:
    tree = check_source(source)
    namespace: Dict[str, Any] = {"__builtins__": SAFE_BUILTINS, **HELPERS}
    exec(compile(tree, "<generated>", "exec"), namespace)  # noqa: S102 - AST-checked above
    return namespace[ENTRY]


def run_function(fn: Callable, lf: pl.LazyFrame, params: Dict[str, Any]) -> pl.LazyFrame:
    out = fn(lf, dict(params))
    if isinstance(out, pl.DataFrame):
        out = out.lazy()
    if not isinstance(out, pl.LazyFrame):
        raise SandboxError(f"`{ENTRY}` must return a LazyFrame, got {type(out).__name__}")
    return out
