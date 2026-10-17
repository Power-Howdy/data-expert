"""Run a plan on the full data. Purely local: no model calls, nothing leaves the machine."""
from app.models.ai_schemas import ApplyPlanRequest, JobStatus
from app.services.ai.jobs import Job, job_manager
from app.services.ai.planner import TEST_ROWS, check_plan
from app.services.ai.views import view_store
from app.services.functions.library import function_library


def _execute(request: ApplyPlanRequest, job: Job) -> None:
    lf = view_store.base_frame(request.dataset_id, request.view_id)
    plan = request.plan
    job.progress(0, len(plan.steps), "Checking plan…")
    check_plan(plan, lf.head(TEST_ROWS).collect())

    for i, step in enumerate(plan.steps, start=1):
        if job.cancelled():
            return
        label = f"Step {i}/{len(plan.steps)}: {step.description or step.op}"
        job.progress(i - 1, len(plan.steps), label)
        try:
            lf = function_library.apply(lf, step.op, step.params)
            lf.collect_schema()
        except Exception as e:
            raise ValueError(f"{label} failed: {e}")

    if job.cancelled():
        return
    job.progress(len(plan.steps), len(plan.steps), "Computing result…")
    view = view_store.create(request.dataset_id, lf, request.prompt, plan.steps, parent_view_id=request.view_id)
    view_store.page(view.id, 0, 1, [])
    function_library.record_use([s.op for s in plan.steps])
    job.status.view = view


def start_apply(request: ApplyPlanRequest) -> JobStatus:
    return job_manager.start(lambda job: _execute(request, job))
