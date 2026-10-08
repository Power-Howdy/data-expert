import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.csv as pv
import pyarrow.feather as feather
import pyarrow.orc as orc
import json
import gzip
import os
import threading
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


def detect_format(path: str) -> Optional[DataFormat]:
    """Detect data format from file extension. Unknown files are not data files."""
    path_lower = path.lower()
    matches = (
        (ext, fmt)
        for ext, fmt in sorted(EXTENSION_TO_FORMAT.items(), key=lambda item: len(item[0]), reverse=True)
    )
    for ext, fmt in matches:
        if path_lower.endswith(ext):
            return fmt
    return None


def csv_encoding(encoding: Optional[str]) -> str:
    """Map config encodings to the values Polars accepts."""
    value = (encoding or "utf8").lower().replace("_", "-")
    if value in {"utf-8", "utf8"}:
        return "utf8"
    if value in {"utf-8-lossy", "utf8-lossy"}:
        return "utf8-lossy"
    return "utf8"


FULL_STATS_LIMIT_BYTES = 256 * 1024 * 1024


def parquet_footer_stats(path: str, column_count: int) -> Optional[DatasetStats]:
    """Row count, size and null counts from the Parquet footer: no data pages are read."""
    try:
        meta = pq.ParquetFile(path).metadata
    except (OSError, ValueError, pa.ArrowException):
        return None
    rows, uncompressed, nulls, complete = meta.num_rows, 0, 0, True
    leaf_count = meta.num_columns
    for g in range(meta.num_row_groups):
        group = meta.row_group(g)
        uncompressed += group.total_byte_size
        for c in range(leaf_count):
            stats = group.column(c).statistics
            if stats is None or not stats.has_null_count:
                complete = False
            else:
                nulls += stats.null_count
    # Null counts are per leaf column; nested columns have several leaves, so this is an estimate there.
    cells = rows * leaf_count
    return DatasetStats(
        row_count=rows,
        column_count=column_count,
        memory_bytes=uncompressed,
        missing_percentage=(nulls / cells * 100 if cells else 0.0) if complete else None,
    )


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
        if format is None:
            raise ValueError(f"Unsupported data file: {Path(path).name}")
        
        lf = self._read_lazy(path, format, **options)
        self._cache[cache_key] = lf
        return lf
    
    def _read_lazy(self, path: str, format: DataFormat, **options) -> pl.LazyFrame:
        """Read file as LazyFrame based on format."""
        path_obj = Path(path)
        
        if format == DataFormat.PARQUET:
            return pl.scan_parquet(path, **options)
        
        elif format == DataFormat.CSV:
            return pl.scan_csv(path, **self._csv_options(options, settings.formats.csv_delimiter))
        
        elif format == DataFormat.TSV:
            return pl.scan_csv(path, **self._csv_options(options, "\t"))
        
        elif format == DataFormat.FEATHER:
            return pl.scan_ipc(path, **options)
        
        elif format == DataFormat.JSON:
            return self._read_json_lazy(path)
        
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
    
    def _csv_options(self, options: Dict[str, Any], separator: str) -> Dict[str, Any]:
        """Build Polars CSV options, normalizing encoding names such as utf-8."""
        extra = {k: v for k, v in options.items() if k not in ["separator", "encoding"]}
        return {
            "separator": options.get("separator", separator),
            "encoding": csv_encoding(options.get("encoding", settings.formats.encoding)),
            **extra,
        }

    def _read_json_lazy(self, path: str) -> pl.LazyFrame:
        """Read a JSON array or object, falling back to newline-delimited JSON."""
        try:
            return pl.read_json(path).lazy()
        except Exception:
            return pl.scan_ndjson(path)

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
        if format is None:
            raise ValueError(f"Unsupported data file: {Path(path).name}")
        
        if format == DataFormat.PARQUET:
            return pl.read_parquet(path, **options)
        elif format == DataFormat.CSV:
            return pl.read_csv(path, **self._csv_options(options, settings.formats.csv_delimiter))
        elif format == DataFormat.TSV:
            return pl.read_csv(path, **self._csv_options(options, "\t"))
        elif format == DataFormat.FEATHER:
            return pl.read_ipc(path, **options)
        elif format == DataFormat.JSON:
            return self._read_json_eager(path)
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
    
    def _read_json_eager(self, path: str) -> pl.DataFrame:
        """Read a JSON array or object, falling back to newline-delimited JSON."""
        try:
            return pl.read_json(path)
        except Exception:
            return pl.read_ndjson(path)

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
    
    def get_stats(
        self, lf: pl.LazyFrame, schema: List[ColumnSchema], path: Optional[str] = None,
        format: Optional[DataFormat] = None,
    ) -> DatasetStats:
        """Facts shown right after opening a file. Never scans a large file: opening must stay instant."""
        column_count = len(schema)
        if format == DataFormat.PARQUET and path:
            stats = parquet_footer_stats(path, column_count)
            if stats:
                return stats
        row_count = lf.select(pl.len()).collect().item()
        size = Path(path).stat().st_size if path else 0
        if path and size >= FULL_STATS_LIMIT_BYTES:
            return DatasetStats(row_count=row_count, column_count=column_count, memory_bytes=size)
        df = lf.collect()
        total_cells = row_count * column_count
        null_count = df.null_count().sum_horizontal().item() if column_count else 0
        try:
            duplicates: Optional[int] = max(0, row_count - df.n_unique())
        except pl.exceptions.PolarsError:
            duplicates = None
        return DatasetStats(
            row_count=row_count,
            column_count=column_count,
            memory_bytes=df.estimated_size(),
            missing_percentage=(null_count / total_cells * 100) if total_cells else 0.0,
            duplicate_rows=duplicates,
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
    """Manages loaded datasets and persists them so they survive restarts."""
    
    def __init__(self, registry_path: Optional[str] = None):
        self.datasets: Dict[str, Dataset] = {}
        self.dataframes: Dict[str, pl.LazyFrame] = {}
        self.options: Dict[str, Dict[str, Any]] = {}
        self.loader = DataLoader()
        self.registry_path = Path(registry_path or settings.data.registry_path)
        self._lock = threading.RLock()
        self.restore()
    
    def load_dataset(self, request) -> Dataset:
        """Load a dataset from path, reusing the existing entry for the same file."""
        path = str(Path(request.path).resolve())
        existing = self.find_by_path(path)
        if existing:
            self.unload_dataset(existing.id, persist=False)
        
        format = request.format or detect_format(path)
        if format is None:
            raise ValueError(f"Unsupported data file: {Path(path).name}")
        
        dataset, lf = self._build(
            path, format, request.name or Path(path).stem, request.options,
            dataset_id=existing.id if existing else None,
        )
        self.register(dataset, lf, request.options)
        return dataset
    
    def _build(
        self, path: str, format: DataFormat, name: str,
        options: Dict[str, Any], dataset_id: Optional[str] = None,
    ):
        self.loader._cache = {k: v for k, v in self.loader._cache.items() if not k.startswith(f"{path}:")}
        lf = self.loader.load_lazy(path, format, **options)
        schema = self.loader.get_schema(lf)
        stats = self.loader.get_stats(lf, schema, path, format)
        file_stat = Path(path).stat()
        dataset = Dataset(
            name=name,
            path=path,
            format=format,
            schema=schema,
            stats=stats,
            row_count=stats.row_count,
            size_bytes=file_stat.st_size,
            last_modified=datetime.fromtimestamp(file_stat.st_mtime),
            **({"id": dataset_id} if dataset_id else {}),
        )
        return dataset, lf
    
    def register(self, dataset: Dataset, lf: pl.LazyFrame, options: Optional[Dict[str, Any]] = None) -> None:
        """Track a dataset in memory and persist the registry."""
        self.datasets[dataset.id] = dataset
        self.dataframes[dataset.id] = lf
        self.options[dataset.id] = options or {}
        self.save()
    
    def find_by_path(self, path: str) -> Optional[Dataset]:
        target = str(Path(path).resolve()).lower()
        return next((d for d in self.datasets.values() if str(Path(d.path).resolve()).lower() == target), None)
    
    def save(self) -> None:
        """Write dataset handles (path, format, options, metadata) to disk."""
        with self._lock:
            entries = [
                {"dataset": d.model_dump(mode="json", by_alias=True), "options": self.options.get(d.id, {})}
                for d in list(self.datasets.values())
            ]
            try:
                self.registry_path.parent.mkdir(parents=True, exist_ok=True)
                tmp = self.registry_path.with_suffix(".tmp")
                tmp.write_text(json.dumps(entries, indent=2), encoding="utf-8")
                os.replace(tmp, self.registry_path)
            except OSError as e:
                logger.warning(f"Could not save dataset registry: {e}")
    
    def restore(self) -> None:
        """Re-open datasets from the registry; recompute metadata only for changed files."""
        if not self.registry_path.exists():
            return
        try:
            entries = json.loads(self.registry_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            logger.warning(f"Could not read dataset registry: {e}")
            return
        
        for entry in entries:
            try:
                self._restore_entry(entry["dataset"], entry.get("options", {}))
            except Exception as e:
                logger.warning(f"Skipping dataset {entry.get('dataset', {}).get('path')}: {e}")
        self.save()
    
    def _restore_entry(self, saved: Dict[str, Any], options: Dict[str, Any]) -> None:
        dataset = Dataset(**saved)
        file_path = Path(dataset.path)
        if not file_path.exists():
            logger.warning(f"Dataset file missing, dropping: {dataset.path}")
            return
        
        file_stat = file_path.stat()
        unchanged = (
            file_stat.st_size == dataset.size_bytes
            and abs(file_stat.st_mtime - dataset.last_modified.timestamp()) < 1
        )
        if unchanged:
            lf = self.loader.load_lazy(dataset.path, dataset.format, **options)
        else:
            dataset, lf = self._build(dataset.path, dataset.format, dataset.name, options, dataset.id)
        
        self.datasets[dataset.id] = dataset
        self.dataframes[dataset.id] = lf
        self.options[dataset.id] = options
    
    def get_dataset(self, dataset_id: str) -> Optional[Dataset]:
        return self.datasets.get(dataset_id)
    
    def get_dataframe(self, dataset_id: str) -> Optional[pl.LazyFrame]:
        return self.dataframes.get(dataset_id)
    
    def list_datasets(self) -> List[Dataset]:
        return list(self.datasets.values())
    
    def unload_dataset(self, dataset_id: str, persist: bool = True) -> bool:
        if dataset_id in self.datasets:
            del self.datasets[dataset_id]
            self.dataframes.pop(dataset_id, None)
            self.options.pop(dataset_id, None)
            if persist:
                self.save()
            return True
        return False
    
    def clear_cache(self):
        self.loader._cache.clear()


data_loader = DataLoader()
dataset_manager = DatasetManager()