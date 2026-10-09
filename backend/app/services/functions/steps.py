"""Run function-library steps chosen by hand. Purely local: the same checks and executor as AI plans, no model."""
from app.models.ai_schemas import ApplyPlanRequest, JobStatus, StepsPreview, StepsRequest, TransformPlan
from app.services.ai.client import AIError
from app.services.ai.executor import start_apply
from app.services.ai.planner import TEST_ROWS, check_plan
from app.services.ai.views import view_store
from app.services.data_loader import data_loader

PREVIEW_ROWS = 20


def preview_steps(request: StepsRequest) -> StepsPreview:
    """Run the steps on the first TEST_ROWS rows; raises ValueError with a readable message when a step is wrong."""
    sample = view_store.base_frame(request.dataset_id, request.view_id).head(TEST_ROWS).collect()
    try:
        result = check_plan(TransformPlan(steps=request.steps), sample)
    except AIError as e:
        raise ValueError(str(e)) from e
    return StepsPreview(
        columns=data_loader.get_schema(result.lazy()),
        rows=result.head(PREVIEW_ROWS).to_dicts(),
        sample_rows=sample.height,
        result_rows=result.height,
    )


def run_steps(request: StepsRequest) -> JobStatus:
    """Run the steps on all rows in the background; the job's view holds the result, like an AI plan."""
    if not request.steps:
        raise ValueError("Add at least one step")
    plan = TransformPlan(steps=request.steps)
    return start_apply(ApplyPlanRequest(
        dataset_id=request.dataset_id, plan=plan, prompt=request.description, view_id=request.view_id,
    ))
