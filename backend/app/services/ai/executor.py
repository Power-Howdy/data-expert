from typing import List

import polars as pl

from app.models.ai_schemas import ApplyPlanRequest, JobStatus
from app.services.ai.client import LLMClient
from app.services.ai.jobs import Job, job_manager
from app.services.ai.operations import apply_operation
from app.services.ai.planner import validate_plan
from app.services.ai.row_ai import run_ai_column
from app.services.ai.settings_store import ai_settings_store
from app.services.ai.views import view_store


def _execute(request: ApplyPlanRequest, job: Job) -> None:
    lf = view_store.base_frame(request.dataset_id, request.view_id)
    current = ai_settings_store.get()
    total = lf.select(pl.len()).collect().item()
    plan = validate_plan(request.plan, list(lf.collect_schema().names()), total, current.model.max_ai_rows)
    client = LLMClient.from_settings() if any(s.op == "ai_column" for s in plan.steps) else None
    notes: List[str] = []

    for i, step in enumerate(plan.steps, start=1):
        if job.cancelled():
            return
        label = f"Step {i}/{len(plan.steps)}: {step.description or step.op}"
        job.progress(0, 0, label)
        try:
            if step.op == "ai_column":
                lf, note = run_ai_column(
                    lf, step.params, client, current.prompts, current.model,
                    progress=lambda done, n: job.progress(done, n, label), cancelled=job.cancelled,
                )
                notes += [note] if note else []
            else:
                lf = apply_operation(lf, step.op, step.params)
                lf.collect_schema()
        except KeyError as e:
            raise ValueError(f"{label} is missing parameter {e}")
        except Exception as e:
            raise ValueError(f"{label} failed: {e}")

    if job.cancelled():
        return
    job.progress(0, 0, "Preparing result…")
    view = view_store.create(
        request.dataset_id, lf, request.prompt, plan.steps, parent_view_id=request.view_id, notes=notes,
    )
    view_store.page(view.id, 0, 1, [])
    job.status.view = view


def start_apply(request: ApplyPlanRequest) -> JobStatus:
    return job_manager.start(lambda job: _execute(request, job))
