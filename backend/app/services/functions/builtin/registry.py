from typing import Any, Callable, Dict, List, Optional, Tuple

import polars as pl

from app.models.function_schemas import FunctionParam, FunctionSpec

Impl = Callable[[pl.LazyFrame, pl.Schema, Dict[str, Any]], pl.LazyFrame]
BUILTINS: Dict[str, Tuple[FunctionSpec, Impl]] = {}


def P(name: str, type: str = "any", description: str = "", required: bool = True,
      default: Any = None, options: Optional[List[str]] = None) -> FunctionParam:
    return FunctionParam(
        name=name, type=type, description=description, required=required and default is None,
        default=default, options=options or [],
    )


def builtin(
    name: str, title: str, category: str, purpose: str, params: List[FunctionParam],
    input: str, output: str, example: Optional[Dict[str, Any]] = None,
) -> Callable[[Impl], Impl]:
    def register(fn: Impl) -> Impl:
        spec = FunctionSpec(
            name=name, title=title, category=category, purpose=purpose, params=params,
            input=input, output=output, example=example or {}, source="builtin",
        )
        BUILTINS[name] = (spec, fn)
        return fn
    return register


def target(p: Dict[str, Any]) -> str:
    """Output column: new_column when given, otherwise overwrite the source column."""
    return p.get("new_column") or p["column"]
