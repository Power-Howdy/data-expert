import re
from pathlib import Path

import polars as pl

from app.models.ai_schemas import SaveAsRequest
from app.models.schemas import DataFormat, Dataset, LoadDatasetRequest
from app.services.functions.expressions import filter_expr
from app.services.ai.views import view_store
from app.services.data_loader import dataset_manager, data_loader

EXTENSIONS = {"parquet": ".parquet", "jsonl": ".jsonl", "csv": ".csv", "json": ".json"}


def _safe_name(name: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip().strip(".")
    if not cleaned:
        raise ValueError("Enter a name for the new dataset")
    return cleaned


def _write(lf: pl.LazyFrame, path: Path, fmt: str) -> None:
    try:
        if fmt == "parquet":
            return lf.sink_parquet(path)
        if fmt == "jsonl":
            return lf.sink_ndjson(path)
        if fmt == "csv":
            return lf.sink_csv(path)
    except Exception:
        path.unlink(missing_ok=True)
    data_loader.write(lf.collect(), str(path), DataFormat(fmt))


def save_as_dataset(dataset_id: str, request: SaveAsRequest) -> Dataset:
    source = dataset_manager.get_dataset(dataset_id)
    if not source:
        raise ValueError(f"Dataset {dataset_id} not found")
    lf = view_store.base_frame(dataset_id, request.view_id)
    schema = lf.collect_schema()
    for f in request.filters:
        lf = lf.filter(filter_expr(schema, f.column, f.operator, f.value))

    name = _safe_name(request.name)
    target = Path(source.path).parent / f"{name}{EXTENSIONS[request.format]}"
    if target.resolve() == Path(source.path).resolve():
        raise ValueError("Choose a different name; this would overwrite the source dataset")
    if target.exists() and not request.overwrite:
        raise FileExistsError(f"{target.name} already exists")
    if request.format == "csv" and any(isinstance(t, (pl.List, pl.Struct, pl.Array)) for t in schema.values()):
        raise ValueError("CSV cannot store list or nested columns; choose Parquet or JSONL")

    _write(lf, target, request.format)
    return dataset_manager.load_dataset(LoadDatasetRequest(path=str(target), name=name))
