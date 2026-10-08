from fastapi import FastAPI, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sse_starlette.sse import EventSourceResponse
from typing import List, Optional, Dict, Any
import json
import asyncio
import polars as pl
from contextlib import asynccontextmanager

from app.core.config import settings
from app.services.data_loader import dataset_manager, data_loader
from app.services.search_engine import search_engine
from app.services.analytics import analytics_engine
from app.services.manipulation import manipulation_engine
from app.services.combine import combine_engine
from app.services.export import export_engine
from app.services.directory_scanner import directory_scanner
from app.services.ai.views import view_store
from app.services.profile_store import insights_store
from app.api.ai_routes import router as ai_router
from app.models.schemas import (
    Dataset, LoadDatasetRequest, ScanRequest, ScanResponse,
    PaginationParams, FilterParams, SortParams, FilterRequest, SortRequest,
    SearchRequest, SearchResponse, RowsResponse, RowData,
    AddRowRequest, UpdateRowRequest, ReplaceRequest, TransformRequest,
    CombineRequest, SeparateRequest, ExportRequest,
    DatasetProfile, AnalyticsOverview, ErrorResponse, SuccessResponse,
    DataFormat, ChangesSummary,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Data Expert Backend...")
    yield
    # Shutdown
    print("Shutting down Data Expert Backend...")
    dataset_manager.clear_cache()


app = FastAPI(
    title="Data Expert API",
    description="Backend API for Data Expert System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.server.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.include_router(ai_router)


# Dependency for dataset validation
def get_dataset(dataset_id: str) -> Dataset:
    dataset = dataset_manager.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return dataset


# ==================== Directory & Dataset Management ====================

@app.post("/api/directories/pick")
async def pick_directory():
    """Open a native OS folder picker and return the selected path."""
    def _pick() -> Optional[str]:
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            path = filedialog.askdirectory(title="Select data folder")
            root.destroy()
            return path or None
        except Exception as e:
            raise RuntimeError(f"Folder picker unavailable: {e}") from e

    try:
        path = await asyncio.to_thread(_pick)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if not path:
        raise HTTPException(status_code=400, detail="No folder selected")
    return {"path": path}


@app.get("/api/directories/tree")
def get_directory_tree(path: str = Query(...), max_depth: int = Query(3)):
    """Get directory tree for sidebar."""
    try:
        tree = directory_scanner.get_directory_tree(path, max_depth)
        return tree
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/directories/scan", response_model=ScanResponse)
def scan_directory(request: ScanRequest):
    """Scan directory for data files."""
    try:
        return directory_scanner.scan(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets", response_model=List[Dataset])
async def list_datasets():
    """List all loaded datasets."""
    return dataset_manager.list_datasets()


@app.get("/api/datasets/{dataset_id}", response_model=Dataset)
async def get_dataset_info(dataset_id: str):
    """Get dataset metadata."""
    dataset = get_dataset(dataset_id)
    return dataset


@app.post("/api/datasets/load", response_model=Dataset)
def load_dataset(request: LoadDatasetRequest):
    """Load a dataset from path."""
    try:
        return dataset_manager.load_dataset(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/datasets/{dataset_id}", response_model=SuccessResponse)
async def unload_dataset(dataset_id: str):
    """Unload a dataset."""
    success = dataset_manager.unload_dataset(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    analytics_engine.forget_profile(dataset_id)
    insights_store.delete(dataset_id)
    view_store.drop_dataset(dataset_id)
    manipulation_engine.discard_changes(dataset_id)
    return SuccessResponse(message=f"Dataset {dataset_id} unloaded")


# ==================== Data Browsing ====================

@app.get("/api/datasets/{dataset_id}/rows", response_model=RowsResponse)
def get_rows(
    dataset_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    filters: Optional[str] = Query(None),
    sorts: Optional[str] = Query(None)
):
    """Get paginated rows with optional filtering and sorting."""
    dataset = get_dataset(dataset_id)
    
    filter_list = None
    if filters:
        try:
            filter_list = [FilterParams(**f) for f in json.loads(filters)]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid filters format")
    
    sort_list = None
    if sorts:
        try:
            sort_list = [SortParams(**s) for s in json.loads(sorts)]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid sorts format")
    
    try:
        return manipulation_engine.get_rows(dataset_id, offset, limit, filter_list, sort_list)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/schema")
async def get_schema(dataset_id: str):
    """Get dataset schema."""
    dataset = get_dataset(dataset_id)
    return {"columns": dataset.columns_schema}


@app.get("/api/datasets/{dataset_id}/stream")
async def stream_rows(
    dataset_id: str,
    offset: int = Query(0, ge=0),
    chunk_size: int = Query(1000, ge=1, le=10000)
):
    """Stream rows via Server-Sent Events."""
    dataset = get_dataset(dataset_id)
    lf = dataset_manager.get_dataframe(dataset_id)
    
    async def generate():
        total = lf.select(pl.len()).collect().item()
        for i in range(offset, total, chunk_size):
            chunk = lf.slice(i, chunk_size).collect()
            for row in chunk.iter_rows(named=True):
                yield {"data": json.dumps(row), "event": "row"}
            await asyncio.sleep(0.01)
        yield {"data": json.dumps({"done": True}), "event": "complete"}
    
    return EventSourceResponse(generate())


# ==================== Search ====================

@app.post("/api/datasets/{dataset_id}/search", response_model=SearchResponse)
def search_dataset(dataset_id: str, request: SearchRequest):
    """Full-text search in dataset."""
    dataset = get_dataset(dataset_id)
    request.dataset_id = dataset_id
    
    try:
        return search_engine.search(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/search/suggest")
def search_suggest(dataset_id: str, q: str = Query(...), limit: int = Query(10)):
    """Get search suggestions."""
    dataset = get_dataset(dataset_id)
    try:
        suggestions = search_engine.suggest(dataset_id, q, limit)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/{dataset_id}/search/index")
def build_search_index(dataset_id: str):
    """Build search index for dataset."""
    dataset = get_dataset(dataset_id)
    try:
        result = search_engine.build_index(dataset_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Analytics ====================

@app.get("/api/datasets/{dataset_id}/stats", response_model=AnalyticsOverview)
def get_stats(dataset_id: str):
    """Get dataset overview statistics."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.get_overview(dataset_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/profile", response_model=DatasetProfile)
def get_profile(
    dataset_id: str,
    sample_size: Optional[int] = Query(None),
    refresh: bool = Query(False),
):
    """Get the saved dataset profile, generating it if missing or when refresh=true."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.profile_dataset(dataset_id, sample_size, refresh)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/profile/saved", response_model=Optional[DatasetProfile])
def get_saved_profile(dataset_id: str):
    """Get the previously generated profile without computing a new one (null if none)."""
    get_dataset(dataset_id)
    return analytics_engine.get_saved_profile(dataset_id)


@app.get("/api/datasets/{dataset_id}/distributions/{column}")
def get_distribution(dataset_id: str, column: str, bins: int = Query(50)):
    """Get column distribution."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.get_column_distribution(dataset_id, column, bins)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/outliers/{column}")
def get_outliers(
    dataset_id: str, 
    column: str, 
    method: str = Query("iqr"),
    threshold: float = Query(1.5)
):
    """Detect outliers in column."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.detect_outliers(dataset_id, column, method, threshold)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Data Manipulation ====================

def _edit(fn, *args):
    try:
        return fn(*args)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e).strip("'\""))
    except (ValueError, TypeError, pl.exceptions.PolarsError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/rows/{row_id}", response_model=RowData)
def get_row(dataset_id: str, row_id: str):
    """One row, including pending edits."""
    get_dataset(dataset_id)
    return _edit(manipulation_engine.get_row, dataset_id, row_id)


@app.post("/api/datasets/{dataset_id}/rows", response_model=RowData)
def add_row(dataset_id: str, request: AddRowRequest):
    """Add a row (pending until committed)."""
    get_dataset(dataset_id)
    return _edit(manipulation_engine.add_row, dataset_id, request.data)


@app.put("/api/datasets/{dataset_id}/rows/{row_id}", response_model=RowData)
def update_row(dataset_id: str, row_id: str, request: UpdateRowRequest):
    """Change fields of a row (pending until committed); only changed fields are recorded."""
    get_dataset(dataset_id)
    return _edit(manipulation_engine.update_row, dataset_id, row_id, request.data)


@app.delete("/api/datasets/{dataset_id}/rows/{row_id}", response_model=SuccessResponse)
def delete_row(dataset_id: str, row_id: str):
    """Delete a row (pending until committed)."""
    get_dataset(dataset_id)
    _edit(manipulation_engine.delete_row, dataset_id, row_id)
    return SuccessResponse(message=f"Row {row_id} deleted")


@app.post("/api/datasets/{dataset_id}/replace/preview", response_model=SuccessResponse)
def preview_replace(dataset_id: str, request: ReplaceRequest):
    """Count rows a find & replace would change."""
    get_dataset(dataset_id)
    count = _edit(manipulation_engine.count_matches, dataset_id, request)
    return SuccessResponse(message=f"{count} matching rows", data={"count": count})


@app.post("/api/datasets/{dataset_id}/replace", response_model=SuccessResponse)
def replace_values(dataset_id: str, request: ReplaceRequest):
    """Find & replace in a column (pending until committed)."""
    get_dataset(dataset_id)
    count = _edit(manipulation_engine.replace_values, dataset_id, request)
    return SuccessResponse(message=f"Replaced values in {count} rows", data={"count": count})


@app.post("/api/datasets/{dataset_id}/transform", response_model=SuccessResponse)
def transform_dataset(dataset_id: str, request: TransformRequest):
    """Apply function-library steps to the dataset (pending until committed)."""
    get_dataset(dataset_id)
    steps = _edit(manipulation_engine.transform, dataset_id, request.operations, request.description)
    return SuccessResponse(message=f"Applied {steps} step(s)", data={"steps": steps})


@app.get("/api/datasets/{dataset_id}/changes", response_model=ChangesSummary)
def get_changes(dataset_id: str):
    """Pending (uncommitted) edits."""
    get_dataset(dataset_id)
    return manipulation_engine.summary(dataset_id)


@app.post("/api/datasets/{dataset_id}/changes/undo", response_model=ChangesSummary)
def undo_change(dataset_id: str):
    """Drop the most recent pending edit."""
    get_dataset(dataset_id)
    manipulation_engine.undo(dataset_id)
    return manipulation_engine.summary(dataset_id)


@app.post("/api/datasets/{dataset_id}/commit", response_model=SuccessResponse)
def commit_changes(dataset_id: str):
    """Write pending edits to the dataset's file."""
    get_dataset(dataset_id)
    result = _edit(manipulation_engine.commit_changes, dataset_id)
    view_store.drop_dataset(dataset_id)
    search_engine.delete_index(dataset_id)
    return SuccessResponse(message="Changes saved to file", data=result)


@app.post("/api/datasets/{dataset_id}/discard", response_model=SuccessResponse)
def discard_changes(dataset_id: str):
    """Discard pending edits."""
    get_dataset(dataset_id)
    manipulation_engine.discard_changes(dataset_id)
    return SuccessResponse(message="Changes discarded")


# ==================== Combine/Separate ====================

@app.post("/api/datasets/combine", response_model=Dataset)
def combine_datasets(request: CombineRequest):
    """Combine multiple datasets."""
    try:
        return combine_engine.combine(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/separate", response_model=List[Dataset])
def separate_dataset(request: SeparateRequest):
    """Separate dataset by column values."""
    try:
        return combine_engine.separate(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/combine/preview")
def preview_combine(
    dataset_ids: List[str] = Body(...),
    strategy: str = Body("concat"),
    join_config: Optional[Dict[str, Any]] = Body(None),
    limit: int = Body(10)
):
    """Preview combine operation."""
    try:
        preview = combine_engine.preview_combine(dataset_ids, strategy, join_config, limit)
        return {"preview": preview.head(limit).to_dicts()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Export ====================

@app.post("/api/datasets/{dataset_id}/export")
def export_dataset(dataset_id: str, request: ExportRequest):
    """Export dataset to file."""
    dataset = get_dataset(dataset_id)
    request.dataset_id = dataset_id
    
    try:
        result = export_engine.export(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/export/stream")
async def export_stream(
    dataset_id: str,
    format: DataFormat = Query(...),
    columns: Optional[str] = Query(None),
    compression: Optional[str] = Query(None)
):
    """Stream export for large datasets."""
    dataset = get_dataset(dataset_id)
    
    col_list = json.loads(columns) if columns else None
    request = ExportRequest(
        dataset_id=dataset_id,
        format=format,
        columns=col_list,
        compression=compression
    )
    
    def generate():
        for chunk in export_engine.export_stream(request):
            yield chunk
    
    media_type = {
        DataFormat.JSONL: "application/x-ndjson",
        DataFormat.CSV: "text/csv",
        DataFormat.JSON: "application/json",
    }.get(format, "application/octet-stream")
    
    return StreamingResponse(generate(), media_type=media_type)


@app.get("/api/export/formats")
async def get_export_formats():
    """Get supported export formats."""
    return export_engine.get_supported_formats()


# ==================== Health ====================

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.server.host, port=settings.server.port)