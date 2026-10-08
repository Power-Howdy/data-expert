import json
from typing import Any, Dict, List, Optional

import polars as pl

from app.models.ai_schemas import PlanStep, TransformPlan
from app.services.ai.client import AIError, LLMClient
from app.services.ai.operations import apply_operation, step_columns
from app.services.ai.prompts import OPERATIONS_REFERENCE
from app.services.ai.settings_store import ai_settings_store
from app.services.ai.views import view_store
from app.services.data_loader import dataset_manager
from app.services.profile_store import profile_store

KNOWN_OPS = {
    "filter", "sort", "limit", "sample", "select", "drop", "rename", "dedupe",
    "extract", "derive", "fill_null", "ai_column",
}
SAMPLE_ROWS = 3
SAMPLE_CHARS = 160
PLAN_ATTEMPTS = 2


def _short(value: Any) -> Any:
    text = value if isinstance(value, str) else json.dumps(value, default=str, ensure_ascii=False)
    return text[:SAMPLE_CHARS] + "…" if len(text) > SAMPLE_CHARS else value


def describe_frame(lf: pl.LazyFrame, dataset_id: str, view_id: Optional[str]) -> str:
    schema = lf.collect_schema()
    total = lf.select(pl.len()).collect().item()
    sample = lf.head(SAMPLE_ROWS).collect().to_dicts()
    lines = [f"Rows: {total:,}", "Columns:"]
    profile = None if view_id else _profile_hints(dataset_id)
    for name, dtype in schema.items():
        hint = f" — {profile[name]}" if profile and name in profile else ""
        lines.append(f"- {name}: {dtype}{hint}")
    rows = [{k: _short(v) for k, v in row.items()} for row in sample]
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


def validate_plan(plan: TransformPlan, columns: List[str], total_rows: int, max_ai_rows: int) -> TransformPlan:
    available = list(columns)
    ai_rows, warnings = 0, list(plan.warnings)
    for i, step in enumerate(plan.steps, start=1):
        if step.op not in KNOWN_OPS:
            raise AIError(f"Step {i} uses an unknown operation '{step.op}'")
        missing = [c for c in step_columns(step.op, step.params) if c not in available]
        if step.op == "ai_column" and step.params.get("only_missing"):
            missing = [c for c in missing if c != step.params.get("new_column")]
        if missing:
            raise AIError(f"Step {i} ({step.op}) refers to unknown column(s): {', '.join(missing)}")
        available = _columns_after(step, available)
        if step.op == "ai_column":
            ai_rows += min(max_ai_rows, total_rows)
    if ai_rows and total_rows > max_ai_rows:
        warnings.append(f"AI steps run on at most {max_ai_rows:,} rows each; other rows are left empty.")
    return plan.model_copy(update={"ai_rows": ai_rows, "warnings": warnings})


def _columns_after(step: PlanStep, columns: List[str]) -> List[str]:
    p = step.params
    if step.op == "select":
        return list(p.get("columns", []))
    if step.op == "drop":
        return [c for c in columns if c not in p.get("columns", [])]
    if step.op == "rename":
        return [p.get("mapping", {}).get(c, c) for c in columns]
    new = p.get("new_column")
    return columns + [new] if new and new not in columns else columns


def dry_run(plan: TransformPlan, lf: pl.LazyFrame) -> None:
    """Build every non-AI step lazily so bad parameters fail in the preview instead of mid-run."""
    for i, step in enumerate(plan.steps, start=1):
        if step.op == "ai_column":
            if not step.params.get("new_column") or not step.params.get("instruction"):
                raise AIError(f"Step {i} (ai_column) needs 'new_column' and 'instruction'")
            name = step.params["new_column"]
            if name not in lf.collect_schema().names():
                lf = lf.with_columns(pl.lit(None, dtype=pl.String).alias(name))
            continue
        try:
            lf = apply_operation(lf, step.op, step.params)
            lf.collect_schema()
        except Exception as e:
            raise AIError(f"Step {i} ({step.op}): {e}") from e


def _parse_plan(raw: Any) -> TransformPlan:
    if not isinstance(raw, dict) or not isinstance(raw.get("steps"), list):
        raise AIError("The model returned a plan in an unexpected shape")
    plan = TransformPlan(
        explanation=str(raw.get("explanation", "")),
        steps=[PlanStep(**s) for s in raw["steps"] if isinstance(s, dict) and s.get("op")],
    )
    if not plan.steps:
        raise AIError(plan.explanation or "The model could not turn this request into data operations")
    return plan


def plan_transform(dataset_id: str, prompt: str, view_id: Optional[str] = None) -> TransformPlan:
    lf = view_store.base_frame(dataset_id, view_id)
    current = ai_settings_store.get()
    client = LLMClient.from_settings()
    messages = [
        {"role": "system", "content": f"{current.prompts.system}\n\n{current.prompts.planner}\n\n{OPERATIONS_REFERENCE}"},
        {"role": "user", "content": f"Dataset:\n{describe_frame(lf, dataset_id, view_id)}\n\nRequest: {prompt}"},
    ]
    total = lf.select(pl.len()).collect().item()
    columns = list(lf.collect_schema().names())
    for attempt in range(PLAN_ATTEMPTS):
        raw = client.chat_json(messages, temperature=0)
        try:
            plan = validate_plan(_parse_plan(raw), columns, total, current.model.max_ai_rows)
            dry_run(plan, lf)
            return plan
        except AIError as e:
            if attempt == PLAN_ATTEMPTS - 1:
                raise
            messages += [
                {"role": "assistant", "content": json.dumps(raw, ensure_ascii=False, default=str)},
                {"role": "user", "content": f"That plan is invalid: {e}. Return a corrected JSON plan."},
            ]
    raise AIError("Could not build a valid plan")
