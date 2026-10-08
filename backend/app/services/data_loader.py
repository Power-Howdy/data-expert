import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.csv as pv
import pyarrow.feather as feather
import pyarrow.orc as orc
import json
import gzip
import os
from pathlib import Path
from typing import Optional, List, Dict, Any, Iterator, Union
from datetime import datetime
import logging

from app.models.schemas import DataFormat, DataType, ColumnSchema, DatasetStats, Dataset
from app.core.config import settings

logger = logging.getLogger(__name__)


FORMAT_EXTENSIONS = {
    DataFormat.PARQUET: [".parquet", ".pq"],
    DataFormat.JSON: [".json"],
    DataFormat.JSONL: [".jsonl", ".ndjson"],
    DataFormat.JSON_GZ: [".json.gz", ".jsonl.gz", ".ndjson.gz"],
    DataFormat.CSV: [".csv"],
    DataFormat.TSV: [".tsv"],
    DataFormat.FEATHER: [".feather", ".ft"],
    DataFormat.AVRO: [".avro"],
    DataFormat.ORC: [".orc"],
    DataFormat.XLSX: [".xlsx"],
    DataFormat.XLS: [".xls"],
}

EXTENSION_TO_FORMAT = {}
for fmt, exts in FORMAT_EXTENSIONS.items():
    for ext in exts:
        EXTENSION_TO_FORMAT[ext] = fmt


def detect_format(path: str) -> DataFormat:
    """Detect data format from file extension."""
    path_lower = path.lower()
    for ext, fmt in EXTENSION_TO_FORMAT.items():
        if path_lower.endswith(ext):
            return fmt
    return DataFormat.PARQUET


def polars_to_pydantic_type(dtype: pl.DataType) -> DataType:
    """Convert Polars data type to our DataType enum."""
    if dtype in (pl.Utf8, pl.String):
        return DataType.STRING
    elif dtype in (pl.Int8, pl.Int16, pl.Int32, pl.Int64, pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64):
        return DataType.INTEGER
    elif dtype in (pl.Float32, pl.Float64):
        return DataType.FLOAT
    elif dtype == pl.Boolean:
        return DataType.BOOLEAN
    elif dtype in (pl.Datetime, pl.Datetime("ms"), pl.Datetime("us"), pl.Datetime("ns")):
        return DataType.DATETIME
    elif dtype == pl.Date:
        return DataType.DATE
    elif dtype == pl.Time:
        return DataType.TIME
    elif dtype == pl.Binary:
        return DataType.BINARY
    elif dtype == pl.List:
        return DataType.LIST
    elif dtype == pl.Struct:
        return DataType.STRUCT
    elif dtype == pl.Null:
        return DataType.NULL
    return DataType.UNKNOWN


class DataLoader:
    """Handles loading data from various formats with streaming support."""
    
    def __init__(self):
        self._cache: Dict[str, pl.LazyFrame] = {}
    
    def load_lazy(self, path: str, format: Optional[DataFormat] = None, **options) -> pl.LazyFrame:
        """Load data as LazyFrame for deferred execution."""
        cache_key = f"{path}:{format}:{hash(frozenset(options.items()))}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        if format is None:
            format = detect_format(path)
        
        lf = self._read_lazy(path, format, **options)
        self._cache[cache_key] = lf
        return lf
    
    def _read_lazy(self, path: str, format: DataFormat, **options) -> pl.LazyFrame:
        """Read file as LazyFrame based on format."""
        path_obj = Path(path)
        
        if format == DataFormat.PARQUET:
            return pl.scan_parquet(path, **options)
        
        elif format == DataFormat.CSV:
            return pl.scan_csv(
                path,
                separator=options.get("separator", settings.formats.csv_delimiter),
                encoding=options.get("encoding", settings.formats.encoding),
                **{k: v for k, v in options.items() if k not in ["separator", "encoding"]}
            )
        
        elif format == DataFormat.TSV:
            return pl.scan_csv(
                path,
                separator="\t",
                encoding=options.get("encoding", settings.formats.encoding),
                **{k: v for k, v in options.items() if k not in ["separator", "encoding"]}
            )
        
        elif format == DataFormat.FEATHER:
            return pl.scan_ipc(path, **options)
        
        elif format == DataFormat.JSON:
            return pl.scan_ndjson(path, **options)
        
        elif format == DataFormat.JSONL:
            return pl.scan_ndjson(path, **options)
        
        elif format == DataFormat.JSON_GZ:
            return self._read_json_gz_lazy(path, **options)
        
        elif format == DataFormat.AVRO:
            return self._read_avro_lazy(path, **options)
        
        elif format == DataFormat.ORC:
            return self._read_orc_lazy(path, **options)
        
        elif format in (DataFormat.XLSX, DataFormat.XLS):
            return self._read_excel_lazy(path, format, **options)
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _read_json_gz_lazy(self, path: str, **options) -> pl.LazyFrame:
        """Read gzipped JSON/JSONL as LazyFrame."""
        import gzip
        with gzip.open(path, "rt", encoding=options.get("encoding", "utf-8")) as f:
            first_line = f.readline()
            f.seek(0)
            if first_line.strip().startswith("["):
                data = json.load(f)
                return pl.DataFrame(data).lazy()
            else:
                return pl.scan_ndjson(path, **options)
    
    def _read_avro_lazy(self, path: str, **options) -> pl.LazyFrame:
        """Read Avro file."""
        try:
            import fastavro
            with open(path, "rb") as f:
                reader = fastavro.reader(f)
                records = list(reader)
            return pl.DataFrame(records).lazy()
        except ImportError:
            raise RuntimeError("fastavro not installed. Install with: pip install fastavro")
    
    def _read_orc_lazy(self, path: str, **options) -> pl.LazyFrame:
        """Read ORC file."""
        try:
            table = orc.read_table(path)
            return pl.from_arrow(table).lazy()
        except Exception as e:
            raise RuntimeError(f"Failed to read ORC: {e}")
    
    def _read_excel_lazy(self, path: str, format: DataFormat, **options) -> pl.LazyFrame:
        """Read Excel file."""
        sheet_name = options.get("sheet_name", 0)
        df = pl.read_excel(path, sheet_name=sheet_name, **options)
        return df.lazy()
    
    def load_eager(self, path: str, format: Optional[DataFormat] = None, **options) -> pl.DataFrame:
        """Load data eagerly as DataFrame."""
        if format is None:
            format = detect_format(path)
        
        if format == DataFormat.PARQUET:
            return pl.read_parquet(path, **options)
        elif format == DataFormat.CSV:
            return pl.read_csv(
                path,
                separator=options.get("separator", settings.formats.csv_delimiter),
                encoding=options.get("encoding", settings.formats.encoding),
                **{k: v for k, v in options.items() if k not in ["separator", "encoding"]}
            )
        elif format == DataFormat.TSV:
            return pl.read_csv(
                path,
                separator="\t",
                encoding=options.get("encoding", settings.formats.encoding),
                **{k: v for k, v in options.items() if k not in ["separator", "encoding"]}
            )
        elif format == DataFormat.FEATHER:
            return pl.read_ipc(path, **options)
        elif format == DataFormat.JSON:
            return pl.read_json(path, **options)
        elif format == DataFormat.JSONL:
            return pl.read_ndjson(path, **options)
        elif format == DataFormat.JSON_GZ:
            return self._read_json_gz_eager(path, **options)
        elif format == DataFormat.AVRO:
            return self._read_avro_eager(path, **options)
        elif format == DataFormat.ORC:
            return self._read_orc_eager(path, **options)
        elif format in (DataFormat.XLSX, DataFormat.XLS):
            return self._read_excel_eager(path, format, **options)
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def _read_json_gz_eager(self, path: str, **options) -> pl.DataFrame:
        """Read gzipped JSON/JSONL eagerly."""
        with gzip.open(path, "rt", encoding=options.get("encoding", "utf-8")) as f:
            first_line = f.readline()
            f.seek(0)
            if first_line.strip().startswith("["):
                data = json.load(f)
                return pl.DataFrame(data)
            else:
                return pl.read_ndjson(path, **options)
    
    def _read_avro_eager(self, path: str, **options) -> pl.DataFrame:
        """Read Avro file eagerly."""
        try:
            import fastavro
            with open(path, "rb") as f:
                reader = fastavro.reader(f)
                records = list(reader)
            return pl.DataFrame(records)
        except ImportError:
            raise RuntimeError("fastavro not installed")
    
    def _read_orc_eager(self, path: str, **options) -> pl.DataFrame:
        """Read ORC file eagerly."""
        table = orc.read_table(path)
        return pl.from_arrow(table)
    
    def _read_excel_eager(self, path: str, format: DataFormat, **options) -> pl.DataFrame:
        """Read Excel file eagerly."""
        sheet_name = options.get("sheet_name", 0)
        return pl.read_excel(path, sheet_name=sheet_name, **options)
    
    def get_schema(self, lf: pl.LazyFrame) -> List[ColumnSchema]:
        """Extract schema from LazyFrame."""
        schema = lf.collect_schema()
        columns = []
        for name, dtype in schema.items():
            columns.append(ColumnSchema(
                name=name,
                type=polars_to_pydantic_type(dtype),
                nullable=True
            ))
        return columns
    
    def get_stats(self, lf: pl.LazyFrame, schema: List[ColumnSchema]) -> DatasetStats:
        """Compute dataset statistics."""
        df = lf.collect()
        row_count = df.height
        column_count = df.width
        memory_bytes = df.estimated_size()
        
        null_count = df.null_count().sum_horizontal().item()
        total_cells = row_count * column_count
        missing_percentage = (null_count / total_cells * 100) if total_cells > 0 else 0
        
        duplicate_rows = df.n_unique() - row_count
        
        return DatasetStats(
            row_count=row_count,
            column_count=column_count,
            memory_bytes=memory_bytes,
            missing_percentage=missing_percentage,
            duplicate_rows=max(0, duplicate_rows)
        )
    
    def stream_rows(
        self, 
        lf: pl.LazyFrame, 
        offset: int = 0, 
        limit: int = 100,
        filters: Optional[List[Dict]] = None,
        sorts: Optional[List[Dict]] = None
    ) -> pl.DataFrame:
        """Stream rows with pagination, filtering, and sorting."""
        query = lf
        
        if filters:
            for f in filters:
                col = f["column"]
                op = f["operator"]
                val = f["value"]
                query = self._apply_filter(query, col, op, val)
        
        if sorts:
            for s in sorts:
                col = s["column"]
                ascending = s.get("ascending", True)
                query = query.sort(col, descending=not ascending)
        
        return query.slice(offset, limit).collect()
    
    def _apply_filter(self, lf: pl.LazyFrame, column: str, operator: str, value: Any) -> pl.LazyFrame:
        """Apply filter to LazyFrame."""
        col_expr = pl.col(column)
        
        ops = {
            "eq": col_expr == value,
            "ne": col_expr != value,
            "gt": col_expr > value,
            "gte": col_expr >= value,
            "lt": col_expr < value,
            "lte": col_expr <= value,
            "contains": col_expr.str.contains(str(value)),
            "startswith": col_expr.str.starts_with(str(value)),
            "endswith": col_expr.str.ends_with(str(value)),
            "in": col_expr.is_in(value) if isinstance(value, list) else col_expr == value,
            "not_in": ~col_expr.is_in(value) if isinstance(value, list) else col_expr != value,
            "is_null": col_expr.is_null(),
            "is_not_null": col_expr.is_not_null(),
        }
        
        if operator in ops:
            return lf.filter(ops[operator])
        
        raise ValueError(f"Unknown operator: {operator}")
    
    def write(
        self, 
        df: pl.DataFrame, 
        path: str, 
        format: DataFormat, 
        compression: Optional[str] = None,
        **options
    ) -> None:
        """Write DataFrame to file."""
        path_obj = Path(path)
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        
        if format == DataFormat.PARQUET:
            df.write_parquet(path, compression=compression or "zstd", **options)
        elif format == DataFormat.CSV:
            df.write_csv(path, separator=options.get("separator", ","), **options)
        elif format == DataFormat.TSV:
            df.write_csv(path, separator="\t", **options)
        elif format == DataFormat.FEATHER:
            df.write_ipc(path, compression=compression or "zstd", **options)
        elif format == DataFormat.JSON:
            df.write_json(path, **options)
        elif format == DataFormat.JSONL:
            df.write_ndjson(path, **options)
        elif format == DataFormat.JSON_GZ:
            self._write_json_gz(df, path, **options)
        elif format in (DataFormat.XLSX, DataFormat.XLS):
            df.write_excel(path, **options)
        else:
            raise ValueError(f"Unsupported write format: {format}")
    
    def _write_json_gz(self, df: pl.DataFrame, path: str, **options) -> None:
        """Write DataFrame as gzipped JSONL."""
        with gzip.open(path, "wt", encoding="utf-8") as f:
            for row in df.iter_rows(named=True):
                f.write(json.dumps(row) + "\n")


class DatasetManager:
    """Manages loaded datasets."""
    
    def __init__(self):
        self.datasets: Dict[str, Dataset] = {}
        self.dataframes: Dict[str, pl.LazyFrame] = {}
        self.loader = DataLoader()
    
    def load_dataset(self, request) -> Dataset:
        """Load a dataset from path."""
        path = request.path
        name = request.name or Path(path).stem
        format = request.format or detect_format(path)
        
        lf = self.loader.load_lazy(path, format, **request.options)
        schema = self.loader.get_schema(lf)
        stats = self.loader.get_stats(lf, schema)
        
        dataset = Dataset(
            name=name,
            path=path,
            format=format,
            schema=schema,
            stats=stats,
            row_count=stats.row_count,
            size_bytes=Path(path).stat().st_size,
            last_modified=datetime.fromtimestamp(Path(path).stat().st_mtime),
        )
        
        self.datasets[dataset.id] = dataset
        self.dataframes[dataset.id] = lf
        
        return dataset
    
    def get_dataset(self, dataset_id: str) -> Optional[Dataset]:
        return self.datasets.get(dataset_id)
    
    def get_dataframe(self, dataset_id: str) -> Optional[pl.LazyFrame]:
        return self.dataframes.get(dataset_id)
    
    def list_datasets(self) -> List[Dataset]:
        return list(self.datasets.values())
    
    def unload_dataset(self, dataset_id: str) -> bool:
        if dataset_id in self.datasets:
            del self.datasets[dataset_id]
            del self.dataframes[dataset_id]
            return True
        return False
    
    def clear_cache(self):
        self.loader._cache.clear()


data_loader = DataLoader()
dataset_manager = DatasetManager()