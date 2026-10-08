"""Ask the model to write a new library function. It sees the request, schema and a few sample rows — never the dataset."""
import json
from typing import Any, Dict, Optional

import polars as pl

from app.models.ai_schemas import AIPrompts
from app.models.function_schemas import FunctionParam, FunctionSpec
from app.services.ai.client import AIError, LLMClient
from app.services.ai.prompts import WRITER_CONTRACT
from app.services.functions.library import function_library
from app.services.functions.sandbox import compile_function, run_function

WRITE_ATTEMPTS = 2


def _spec_from_reply(raw: Any, name: str, prompt: str) -> FunctionSpec:
    if not isinstance(raw, dict) or not isinstance(raw.get("code"), str):
        raise AIError("The model did not return a function with code")
    params = [FunctionParam(**p) for p in raw.get("params", []) if isinstance(p, dict) and p.get("name")]
    return FunctionSpec(
        name=name, title=str(raw.get("title") or name.replace("_", " ").capitalize()),
        category=str(raw.get("category") or "transform"), purpose=str(raw.get("purpose", "")),
        params=params, input=str(raw.get("input", "")), output=str(raw.get("output", "")),
        example=raw.get("example") if isinstance(raw.get("example"), dict) else {},
        code=raw["code"], prompt=prompt, source="generated",
    )


def _test(spec: FunctionSpec, sample: pl.DataFrame, params: Optional[Dict[str, Any]]) -> None:
    call = function_library.with_defaults(spec, params or spec.example)
    problems = function_library.check_params(spec, call, sample.columns)
    if problems:
        raise ValueError("; ".join(problems))
    run_function(compile_function(spec.code or ""), sample.lazy(), call).collect()


def generate_function(
    request: Dict[str, Any], frame_description: str, sample: pl.DataFrame,
    client: LLMClient, prompts: AIPrompts, user_prompt: str, call_params: Optional[Dict[str, Any]] = None,
) -> FunctionSpec:
    name = str(request.get("name", "")).strip()
    messages = [
        {"role": "system", "content": f"{prompts.system}\n\n{prompts.function_writer}\n\n{WRITER_CONTRACT}"},
        {"role": "user", "content": (
            f"Write this function:\n{json.dumps(request, ensure_ascii=False)}\n\n"
            f"It will first be used on this dataset (schema and samples only):\n{frame_description}"
        )},
    ]
    for attempt in range(WRITE_ATTEMPTS):
        raw: Any = None
        try:
            raw = client.chat_json(messages, temperature=0)
            spec = _spec_from_reply(raw, name, user_prompt)
            _test(spec, sample, call_params)
            return function_library.add_generated(spec)
        except (AIError, ValueError, pl.exceptions.PolarsError, TypeError, KeyError) as e:
            if attempt == WRITE_ATTEMPTS - 1:
                raise AIError(f"Could not create function '{name}': {e}")
            messages += [
                {"role": "assistant", "content": json.dumps(raw, ensure_ascii=False, default=str)},
                {"role": "user", "content": f"That failed: {e}. Fix it and return the full JSON again."},
            ]
    raise AIError(f"Could not create function '{name}'")
