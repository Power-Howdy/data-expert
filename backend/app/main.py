from fastapi import FastAPI, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
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
from app.models.schemas import (
    Dataset, LoadDatasetRequest, ScanRequest, ScanResponse,
    PaginationParams, FilterParams, SortParams, FilterRequest, SortRequest,
    SearchRequest, SearchResponse, RowsResponse, RowData,
    AddRowRequest, UpdateRowRequest, ReplaceRequest, TransformRequest,
    CombineRequest, SeparateRequest, ExportRequest,
    DatasetProfile, AnalyticsOverview, ErrorResponse, SuccessResponse,
    DataFormat
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
async def get_directory_tree(path: str = Query(...), max_depth: int = Query(3)):
    """Get directory tree for sidebar."""
    try:
        tree = directory_scanner.get_directory_tree(path, max_depth)
        return tree
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/directories/scan", response_model=ScanResponse)
async def scan_directory(request: ScanRequest):
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
async def load_dataset(request: LoadDatasetRequest):
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
    return SuccessResponse(message=f"Dataset {dataset_id} unloaded")


# ==================== Data Browsing ====================

@app.get("/api/datasets/{dataset_id}/rows", response_model=RowsResponse)
async def get_rows(
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
async def search_dataset(dataset_id: str, request: SearchRequest):
    """Full-text search in dataset."""
    dataset = get_dataset(dataset_id)
    request.dataset_id = dataset_id
    
    try:
        return search_engine.search(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/search/suggest")
async def search_suggest(dataset_id: str, q: str = Query(...), limit: int = Query(10)):
    """Get search suggestions."""
    dataset = get_dataset(dataset_id)
    try:
        suggestions = search_engine.suggest(dataset_id, q, limit)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/{dataset_id}/search/index")
async def build_search_index(dataset_id: str):
    """Build search index for dataset."""
    dataset = get_dataset(dataset_id)
    try:
        result = search_engine.build_index(dataset_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Analytics ====================

@app.get("/api/datasets/{dataset_id}/stats", response_model=AnalyticsOverview)
async def get_stats(dataset_id: str):
    """Get dataset overview statistics."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.get_overview(dataset_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/profile", response_model=DatasetProfile)
async def get_profile(dataset_id: str, sample_size: Optional[int] = Query(None)):
    """Get full dataset profile."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.profile_dataset(dataset_id, sample_size)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/distributions/{column}")
async def get_distribution(dataset_id: str, column: str, bins: int = Query(50)):
    """Get column distribution."""
    dataset = get_dataset(dataset_id)
    try:
        return analytics_engine.get_column_distribution(dataset_id, column, bins)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/datasets/{dataset_id}/outliers/{column}")
async def get_outliers(
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

@app.post("/api/datasets/{dataset_id}/rows", response_model=RowData)
async def add_row(dataset_id: str, request: AddRowRequest):
    """Add a new row."""
    dataset = get_dataset(dataset_id)
    try:
        return manipulation_engine.add_row(dataset_id, request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/datasets/{dataset_id}/rows/{row_id}", response_model=RowData)
async def update_row(dataset_id: str, row_id: str, request: UpdateRowRequest):
    """Update a row."""
    dataset = get_dataset(dataset_id)
    try:
        return manipulation_engine.update_row(dataset_id, row_id, request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/datasets/{dataset_id}/rows/{row_id}", response_model=SuccessResponse)
async def delete_row(dataset_id: str, row_id: str):
    """Delete a row."""
    dataset = get_dataset(dataset_id)
    try:
        manipulation_engine.delete_row(dataset_id, row_id)
        return SuccessResponse(message=f"Row {row_id} marked for deletion")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/{dataset_id}/replace", response_model=SuccessResponse)
async def replace_values(dataset_id: str, request: ReplaceRequest):
    """Replace values in a column."""
    dataset = get_dataset(dataset_id)
    try:
        manipulation_engine.replace_values(dataset_id, request)
        return SuccessResponse(message="Replace operation queued")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/{dataset_id}/transform", response_model=SuccessResponse)
async def transform_dataset(dataset_id: str, request: TransformRequest):
    """Apply transformations."""
    dataset = get_dataset(dataset_id)
    try:
        manipulation_engine.transform(dataset_id, request)
        return SuccessResponse(message="Transform operations queued")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/{dataset_id}/commit", response_model=SuccessResponse)
async def commit_changes(dataset_id: str):
    """Commit pending changes to disk."""
    dataset = get_dataset(dataset_id)
    try:
        result = manipulation_engine.commit_changes(dataset_id)
        return SuccessResponse(message="Changes committed", data=result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/{dataset_id}/discard", response_model=SuccessResponse)
async def discard_changes(dataset_id: str):
    """Discard pending changes."""
    dataset = get_dataset(dataset_id)
    manipulation_engine.discard_changes(dataset_id)
    return SuccessResponse(message="Changes discarded")


# ==================== Combine/Separate ====================

@app.post("/api/datasets/combine", response_model=Dataset)
async def combine_datasets(request: CombineRequest):
    """Combine multiple datasets."""
    try:
        return combine_engine.combine(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/separate", response_model=List[Dataset])
async def separate_dataset(request: SeparateRequest):
    """Separate dataset by column values."""
    try:
        return combine_engine.separate(request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/datasets/combine/preview")
async def preview_combine(
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
async def export_dataset(dataset_id: str, request: ExportRequest):
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