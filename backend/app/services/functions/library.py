import json
import logging
import os
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import polars as pl

from app.core.config import settings
from app.models.function_schemas import FunctionSpec
from app.services.functions.builtin import BUILTINS
from app.services.functions.sandbox import compile_function, run_function

logger = logging.getLogger(__name__)
NAME_RE = re.compile(r"^[a-z][a-z0-9_]{1,48}$")


class FunctionLibrary:
    """Built-in functions plus model-generated ones persisted to .data_expert/functions.json."""

    def __init__(self, path: Optional[str] = None):
        self.path = Path(path) if path else Path(settings.data.registry_path).parent / "functions.json"
        self._lock = threading.RLock()
        self._generated: Dict[str, FunctionSpec] = self._load()
        self._compiled: Dict[str, Callable] = {}

    def _load(self) -> Dict[str, FunctionSpec]:
        if not self.path.exists():
            return {}
        try:
            items = json.loads(self.path.read_text(encoding="utf-8"))
            return {s.name: s for s in (FunctionSpec(**i) for i in items) if s.name not in BUILTINS}
        except (OSError, ValueError) as e:
            logger.warning(f"Could not read function library: {e}")
            return {}

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        data = [s.model_dump(mode="json") for s in self._generated.values()]
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)

    def list(self) -> List[FunctionSpec]:
        with self._lock:
            return [spec for spec, _ in BUILTINS.values()] + list(self._generated.values())

    def get(self, name: str) -> Optional[FunctionSpec]:
        if name in BUILTINS:
            return BUILTINS[name][0]
        with self._lock:
            return self._generated.get(name)

    def add_generated(self, spec: FunctionSpec) -> FunctionSpec:
        if not NAME_RE.match(spec.name):
            raise ValueError(f"Invalid function name '{spec.name}' (use snake_case)")
        if spec.name in BUILTINS:
            raise ValueError(f"'{spec.name}' is a built-in function")
        compile_function(spec.code or "")
        spec = spec.model_copy(update={"source": "generated", "created_at": spec.created_at or datetime.now()})
        with self._lock:
            self._generated[spec.name] = spec
            self._save()
        return spec

    def delete(self, name: str) -> bool:
        with self._lock:
            removed = self._generated.pop(name, None) is not None
            if removed:
                self._save()
            return removed

    def record_use(self, names: List[str]) -> None:
        with self._lock:
            touched = [n for n in names if n in self._generated]
            for n in touched:
                self._generated[n].uses += 1
            if touched:
                self._save()

    def with_defaults(self, spec: FunctionSpec, params: Dict[str, Any]) -> Dict[str, Any]:
        merged = {p.name: p.default for p in spec.params if p.default is not None}
        merged.update({k: v for k, v in params.items() if v is not None})
        return merged

    def check_params(self, spec: FunctionSpec, params: Dict[str, Any], columns: List[str]) -> List[str]:
        """Human-readable problems with a call, checked before anything runs."""
        problems = [f"missing '{p.name}'" for p in spec.params if p.required and params.get(p.name) in (None, "", [], {})]
        for p in spec.params:
            value = params.get(p.name)
            if value in (None, ""):
                continue
            if p.type == "column" and value not in columns:
                problems.append(f"'{p.name}' refers to unknown column '{value}'")
            elif p.type == "columns":
                values = value if isinstance(value, list) else [value]
                unknown = [c for c in values if c not in columns]
                if unknown:
                    problems.append(f"'{p.name}' refers to unknown column(s): {', '.join(map(str, unknown))}")
            elif p.type == "enum" and p.options and value not in p.options:
                problems.append(f"'{p.name}' must be one of {', '.join(p.options)}")
        return problems

    def embed(self, names: List[str]) -> Dict[str, Dict[str, Any]]:
        """Specs of the generated functions among `names`, stored with recorded steps so they replay identically later."""
        specs = (self.get(n) for n in set(names) if n not in BUILTINS)
        return {s.name: s.model_dump(mode="json") for s in specs if s}

    def apply(
        self, lf: pl.LazyFrame, name: str, params: Dict[str, Any], embedded: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> pl.LazyFrame:
        spec = FunctionSpec(**embedded[name]) if embedded and name in embedded else self.get(name)
        if not spec:
            raise ValueError(f"Unknown function '{name}'")
        params = self.with_defaults(spec, params)
        for p in spec.params:
            if p.type == "columns" and isinstance(params.get(p.name), str):
                params[p.name] = [params[p.name]]
        if name in BUILTINS:
            return BUILTINS[name][1](lf, lf.collect_schema(), params)
        return run_function(self._compiled_fn(spec), lf, params)

    def _compiled_fn(self, spec: FunctionSpec) -> Callable:
        code = spec.code or ""
        with self._lock:
            if code not in self._compiled:
                self._compiled[code] = compile_function(code)
            return self._compiled[code]

    def catalog(self) -> str:
        """Compact one-line-per-function description used in prompts."""
        return "\n".join(signature(s) for s in self.list())


def signature(spec: FunctionSpec) -> str:
    params = []
    for p in spec.params:
        kind = f"{p.type}[{'|'.join(p.options)}]" if p.options else p.type
        suffix = "" if p.required else (f"={json.dumps(p.default)}" if p.default is not None else "?")
        params.append(f"{p.name}:{kind}{suffix}")
    return f"- {spec.name}({', '.join(params)}): {spec.purpose} In: {spec.input}. Out: {spec.output}."


function_library = FunctionLibrary()
