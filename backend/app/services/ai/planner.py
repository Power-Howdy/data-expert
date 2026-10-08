"""Turn a prompt into a pipeline of library functions. The model sees the catalog, schema and samples — never the data."""
import json
from typing import Any, Dict, List, Optional, Tuple

import polars as pl

from app.models.ai_schemas import PlanStep, TransformPlan
from app.services.ai.client import AIError, LLMClient
from app.services.ai.generator import generate_function
from app.services.ai.prompts import PLAN_FORMAT
from app.services.ai.settings_store import ai_settings_store
from app.services.ai.views import view_store
from app.services.data_loader import dataset_manager
from app.services.functions.library import function_library
from app.services.profile_store import profile_store

SAMPLE_CHARS = 160
TEST_ROWS = 200
PLAN_ATTEMPTS = 2


def _short(value: Any) -> Any:
    text = value if isinstance(value, str) else json.dumps(value, default=str, ensure_ascii=False)
    return text[:SAMPLE_CHARS] + "…" if len(text) > SAMPLE_CHARS else value


def describe_frame(lf: pl.LazyFrame, test: pl.DataFrame, dataset_id: str, view_id: Optional[str], samples: int) -> str:
    total = lf.select(pl.len()).collect().item()
    lines = [f"Rows: {total:,}", "Columns:"]
    profile = None if view_id else _profile_hints(dataset_id)
    for name, dtype in test.schema.items():
        hint = f" — {profile[name]}" if profile and name in profile else ""
        lines.append(f"- {name}: {dtype}{hint}")
    if samples:
        rows = [{k: _short(v) for k, v in row.items()} for row in test.head(samples).to_dicts()]
        lines.append(f"Sample rows:\n{json.dumps(rows, ensure_ascii=False, default=str, indent=1)}")
    return "\n".join(lines)


def _profile_hints(dataset_id: str) -> Optional[Dict[str, str]]:
    dataset = dataset_manager.get_dataset(dataset_id)
    profile = profile_store.load(dataset) if dataset else None
    if not profile:
        return None
    hints = {}
    for c in profile.columns:
        parts = [f"{c.null_percentage:.1f}% null", f"{c.unique_count:,} unique"]
        if c.min is not None and c.max is not None:
            parts.append(f"range {_short(c.min)}..{_short(c.max)}")
        hints[c.name] = ", ".join(parts)
    return hints


def check_plan(plan: TransformPlan, sample: pl.DataFrame) -> pl.DataFrame:
    """Run every step on a small local sample so bad parameters fail before touching the full data."""
    frame = sample
    for i, step in enumerate(plan.steps, start=1):
        spec = function_library.get(step.op)
        if not spec:
            raise AIError(f"Step {i} uses unknown function '{step.op}'")
        problems = function_library.check_params(spec, function_library.with_defaults(spec, step.params), frame.columns)
        if problems:
            raise AIError(f"Step {i} ({step.op}): {'; '.join(problems)}")
        try:
            frame = function_library.apply(frame.lazy(), step.op, step.params).collect()
        except Exception as e:
            raise AIError(f"Step {i} ({step.op}) failed: {e}") from e
    return frame


def _parse(raw: Any) -> Tuple[TransformPlan, List[Dict[str, Any]]]:
    if not isinstance(raw, dict) or not isinstance(raw.get("steps"), list):
        raise AIError("The model returned a plan in an unexpected shape")
    steps = [
        PlanStep(op=str(s.get("function") or s.get("op")), description=str(s.get("description", "")),
                 params=s.get("params") if isinstance(s.get("params"), dict) else {})
        for s in raw["steps"] if isinstance(s, dict) and (s.get("function") or s.get("op"))
    ]
    if not steps:
        raise AIError(str(raw.get("explanation") or "The model could not turn this request into data functions"))
    requests = [r for r in raw.get("new_functions") or [] if isinstance(r, dict) and r.get("name")]
    return TransformPlan(explanation=str(raw.get("explanation", "")), steps=steps), requests


def _create_requested(plan, requests, sample, description, client, prompts, prompt) -> List[str]:
    created = []
    for request in requests:
        name = str(request["name"])
        if function_library.get(name):
            continue
        frame = sample
        for step in plan.steps:
            if step.op == name:
                generate_function(request, description, frame, client, prompts, prompt, step.params)
                created.append(name)
                break
            if function_library.get(step.op):
                frame = function_library.apply(frame.lazy(), step.op, step.params).collect()
    return created


def plan_transform(dataset_id: str, prompt: str, view_id: Optional[str] = None) -> TransformPlan:
    lf = view_store.base_frame(dataset_id, view_id)
    current = ai_settings_store.get()
    client = LLMClient.from_settings()
    sample = lf.head(TEST_ROWS).collect()
    description = describe_frame(lf, sample, dataset_id, view_id, current.model.sample_rows)
    system = f"{current.prompts.system}\n\n{current.prompts.planner}\n\n{PLAN_FORMAT}"
    messages = [
        {"role": "system", "content": f"{system}\n\nFunction library:\n{function_library.catalog()}"},
        {"role": "user", "content": f"Dataset:\n{description}\n\nRequest: {prompt}"},
    ]
    created: List[str] = []
    for attempt in range(PLAN_ATTEMPTS):
        raw: Any = None
        try:
            raw = client.chat_json(messages, temperature=0)
            plan, requests = _parse(raw)
            created += _create_requested(plan, requests, sample, description, client, current.prompts, prompt)
            check_plan(plan, sample)
            return plan.model_copy(update={"new_functions": created})
        except AIError as e:
            if attempt == PLAN_ATTEMPTS - 1:
                raise
            messages += [
                {"role": "assistant", "content": json.dumps(raw, ensure_ascii=False, default=str)},
                {"role": "user", "content": f"That plan is invalid: {e}. Return a corrected JSON plan."},
            ]
    raise AIError("Could not build a valid plan")
