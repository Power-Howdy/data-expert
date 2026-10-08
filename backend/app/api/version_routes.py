"""Version history of a dataset's file: list, compare, preview, restore, export and tag versions."""
import polars as pl
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import Dataset, SuccessResponse
from app.models.version_schemas import (
    SaveVersionRequest, TagRequest, VersionCommit, VersionDiff, VersionHistory, VersionRows, VersionSettingsRequest,
)
from app.services.ai.views import view_store
from app.services.data_loader import dataset_manager
from app.services.manipulation import manipulation_engine
from app.services.search_engine import search_engine
from app.services.versioning.service import version_control

router = APIRouter(prefix="/api/datasets/{dataset_id}/versions", tags=["versions"])


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e).strip("'\""))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except (ValueError, TypeError, OSError, pl.exceptions.PolarsError) as e:
        raise HTTPException(status_code=400, detail=str(e))


def _require(dataset_id: str) -> None:
    if not dataset_manager.get_dataset(dataset_id):
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")


@router.get("", response_model=VersionHistory)
def get_history(dataset_id: str):
    _require(dataset_id)
    return _call(version_control.history, dataset_id)


@router.post("/init", response_model=VersionHistory)
def start_tracking(dataset_id: str):
    _require(dataset_id)
    return _call(version_control.start, dataset_id)


@router.get("/diff", response_model=VersionDiff)
def diff_versions(dataset_id: str, a: str, b: str, rows: bool = False):
    _require(dataset_id)
    return _call(version_control.diff, dataset_id, a, b, rows)


@router.get("/{ref}/rows", response_model=VersionRows)
def version_rows(dataset_id: str, ref: str, offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    _require(dataset_id)
    return _call(version_control.rows, dataset_id, ref, offset, limit)


@router.post("/{ref}/restore", response_model=VersionCommit)
def restore_version(dataset_id: str, ref: str):
    _require(dataset_id)
    if manipulation_engine.has_changes(dataset_id):
        raise HTTPException(status_code=409, detail="Save or discard your pending changes before restoring a version")
    commit = _call(version_control.restore, dataset_id, ref)
    view_store.drop_dataset(dataset_id)
    search_engine.delete_index(dataset_id)
    return commit


@router.post("/{ref}/save-as", response_model=Dataset)
def save_version_as(dataset_id: str, ref: str, request: SaveVersionRequest):
    _require(dataset_id)
    return _call(version_control.save_as, dataset_id, ref, request)


@router.post("/tags", response_model=VersionHistory)
def add_tag(dataset_id: str, request: TagRequest):
    _require(dataset_id)
    return _call(version_control.tag, dataset_id, request.name, request.commit_id)


@router.delete("/tags/{name}", response_model=VersionHistory)
def remove_tag(dataset_id: str, name: str):
    _require(dataset_id)
    return _call(version_control.untag, dataset_id, name)


@router.put("/settings", response_model=VersionHistory)
def update_settings(dataset_id: str, request: VersionSettingsRequest):
    _require(dataset_id)
    return _call(version_control.configure, dataset_id, request.keep_snapshots)


@router.delete("", response_model=SuccessResponse)
def delete_history(dataset_id: str):
    _require(dataset_id)
    _call(version_control.destroy, dataset_id)
    return SuccessResponse(message="Version history deleted")
