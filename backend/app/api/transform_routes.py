"""Data tools without AI: the function library, previewed and run on the user's own steps."""
from typing import List

import polars as pl
from fastapi import APIRouter, HTTPException

from app.models.ai_schemas import JobStatus, StepsPreview, StepsRequest
from app.models.function_schemas import FunctionSpec
from app.services.ai.jobs import job_manager
from app.services.data_loader import dataset_manager
from app.services.functions.library import function_library
from app.services.functions.steps import preview_steps, run_steps

router = APIRouter(prefix="/api")


def _require_dataset(dataset_id: str) -> None:
    if not dataset_manager.get_dataset(dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")


@router.get("/functions", response_model=List[FunctionSpec])
def list_functions():
    return function_library.list()


@router.post("/transform/preview", response_model=StepsPreview)
def preview(request: StepsRequest):
    _require_dataset(request.dataset_id)
    try:
        return preview_steps(request)
    except (ValueError, TypeError, pl.exceptions.PolarsError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/transform/run", response_model=JobStatus)
def run(request: StepsRequest):
    _require_dataset(request.dataset_id)
    try:
        return run_steps(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/transform/jobs/{job_id}", response_model=JobStatus)
def get_job(job_id: str):
    try:
        return job_manager.get(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Job not found")


@router.post("/transform/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    job_manager.cancel(job_id)
    return {"success": True}
