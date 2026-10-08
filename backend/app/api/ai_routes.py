import json
from typing import Dict, List, Optional

import polars as pl
from fastapi import APIRouter, HTTPException, Query

from app.models.ai_schemas import (
    AIInsights, AISettingsPublic, AISettingsUpdate, ApplyPlanRequest, InsightsRequest, JobStatus,
    PlanRequest, ProviderTestRequest, ProviderTestResponse, SaveAsRequest, TransformPlan, ViewInfo,
)
from app.models.function_schemas import FunctionSpec
from app.models.schemas import Dataset, FilterParams, RowData, RowsResponse
from app.services.ai.client import AIError, LLMClient
from app.services.ai.executor import start_apply
from app.services.ai.insights import generate_insights, get_saved_insights
from app.services.ai.jobs import job_manager
from app.services.ai.planner import plan_transform
from app.services.ai.settings_store import ai_settings_store
from app.services.ai.views import view_store
from app.services.data_loader import dataset_manager
from app.services.functions.library import function_library
from app.services.save_as import save_as_dataset

router = APIRouter(prefix="/api")


def _require_dataset(dataset_id: str) -> None:
    if not dataset_manager.get_dataset(dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")


def _client_for(request: ProviderTestRequest) -> LLMClient:
    return LLMClient(ai_settings_store.merge_provider(request.provider), ai_settings_store.get().model)


# ==================== Settings ====================

@router.get("/ai/settings", response_model=AISettingsPublic)
def get_ai_settings():
    return ai_settings_store.public()


@router.put("/ai/settings", response_model=AISettingsPublic)
def update_ai_settings(update: AISettingsUpdate):
    try:
        ai_settings_store.update(update)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ai_settings_store.public()


@router.post("/ai/models")
def list_models(request: ProviderTestRequest) -> Dict[str, List[str]]:
    try:
        return {"models": _client_for(request).list_models()}
    except AIError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai/test", response_model=ProviderTestResponse)
def test_provider(request: ProviderTestRequest):
    try:
        return ProviderTestResponse(ok=True, **_client_for(request).ping())
    except AIError as e:
        return ProviderTestResponse(ok=False, error=str(e))


# ==================== Transform ====================

@router.post("/ai/plan", response_model=TransformPlan)
def create_plan(request: PlanRequest):
    _require_dataset(request.dataset_id)
    try:
        return plan_transform(request.dataset_id, request.prompt, request.view_id)
    except (AIError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ai/apply", response_model=JobStatus)
def apply_plan(request: ApplyPlanRequest):
    _require_dataset(request.dataset_id)
    return start_apply(request)


@router.get("/ai/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    try:
        return job_manager.get(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Job not found")


@router.post("/ai/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    job_manager.cancel(job_id)
    return {"success": True}


# ==================== Function library ====================

@router.get("/ai/functions", response_model=List[FunctionSpec])
def list_functions():
    return function_library.list()


@router.delete("/ai/functions/{name}")
def delete_function(name: str):
    if function_library.get(name) and function_library.get(name).source == "builtin":
        raise HTTPException(status_code=400, detail="Built-in functions cannot be deleted")
    return {"success": function_library.delete(name)}


# ==================== Views ====================

@router.get("/views/{view_id}", response_model=ViewInfo)
def get_view(view_id: str):
    try:
        return view_store.get(view_id)[0]
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/views/{view_id}/rows", response_model=RowsResponse)
def get_view_rows(
    view_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    filters: Optional[str] = Query(None),
):
    try:
        filter_list = [FilterParams(**f) for f in json.loads(filters)] if filters else []
        total, data = view_store.page(view_id, offset, limit, filter_list)
    except (ValueError, TypeError, pl.exceptions.PolarsError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    rows = [RowData(id=str(offset + i), data=row) for i, row in enumerate(data)]
    return RowsResponse(rows=rows, total=total, offset=offset, limit=limit)


@router.delete("/views/{view_id}")
def delete_view(view_id: str):
    return {"success": view_store.delete(view_id)}


@router.post("/datasets/{dataset_id}/save-as", response_model=Dataset)
def save_as(dataset_id: str, request: SaveAsRequest):
    _require_dataset(dataset_id)
    try:
        return save_as_dataset(dataset_id, request)
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Insights ====================

@router.get("/datasets/{dataset_id}/ai/insights", response_model=Optional[AIInsights])
def saved_insights(dataset_id: str):
    _require_dataset(dataset_id)
    return get_saved_insights(dataset_id)


@router.post("/datasets/{dataset_id}/ai/insights", response_model=AIInsights)
def create_insights(dataset_id: str, request: InsightsRequest):
    _require_dataset(dataset_id)
    try:
        return generate_insights(dataset_id, request.focus)
    except (AIError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
