import polars as pl
from pathlib import Path
from typing import Optional, List, Dict, Any, Iterator
import uuid
import gzip
import json
import logging

from app.models.schemas import (
    Dataset, DataFormat, ExportRequest, DataType
)
from app.services.data_loader import dataset_manager, data_loader
from app.core.config import settings

logger = logging.getLogger(__name__)


class ExportEngine:
    """Handle dataset export to various formats."""
    
    def export(self, request: ExportRequest) -> Dict[str, Any]:
        """Export dataset to specified format."""
        lf = dataset_manager.get_dataframe(request.dataset_id)
        if lf is None:
            raise ValueError(f"Dataset {request.dataset_id} not found")
        
        dataset = dataset_manager.get_dataset(request.dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {request.dataset_id} not found")
        
        # Apply filters
        if request.filters:
            for f in request.filters:
                lf = self._apply_filter(lf, f.column, f.operator, f.value)
        
        # Select columns
        if request.columns:
            lf = lf.select(request.columns)
        
        # Determine output path
        if request.output_path:
            output_path = request.output_path
        else:
            output_path = self._generate_output_path(dataset.name, request.format)
        
        # Collect data
        df = lf.collect()
        
        # Write based on format
        if request.format == DataFormat.PARQUET:
            self._write_parquet(df, output_path, request.compression, request.partition_by)
        elif request.format == DataFormat.CSV:
            self._write_csv(df, output_path, request.compression)
        elif request.format == DataFormat.TSV:
            self._write_tsv(df, output_path, request.compression)
        elif request.format == DataFormat.JSON:
            self._write_json(df, output_path, request.compression)
        elif request.format == DataFormat.JSONL:
            self._write_jsonl(df, output_path, request.compression)
        elif request.format == DataFormat.FEATHER:
            self._write_feather(df, output_path, request.compression)
        elif request.format == DataFormat.JSON_GZ:
            self._write_json_gz(df, output_path)
        else:
            raise ValueError(f"Unsupported export format: {request.format}")
        
        return {
            "success": True,
            "path": output_path,
            "rows": df.height,
            "columns": df.width,
            "format": request.format.value,
            "size_bytes": Path(output_path).stat().st_size
        }
    
    def export_stream(
        self, 
        request: ExportRequest, 
        chunk_size: int = 10000
    ) -> Iterator[bytes]:
        """Stream export for large datasets."""
        lf = dataset_manager.get_dataframe(request.dataset_id)
        if lf is None:
            raise ValueError(f"Dataset {request.dataset_id} not found")
        
        # Apply filters
        if request.filters:
            for f in request.filters:
                lf = self._apply_filter(lf, f.column, f.operator, f.value)
        
        # Select columns
        if request.columns:
            lf = lf.select(request.columns)
        
        total_rows = lf.select(pl.len()).collect().item()
        
        for offset in range(0, total_rows, chunk_size):
            chunk = lf.slice(offset, chunk_size).collect()
            yield self._format_chunk(chunk, request.format)
    
    def _format_chunk(self, df: pl.DataFrame, format: DataFormat) -> bytes:
        """Format a chunk for streaming."""
        if format == DataFormat.JSONL:
            return df.write_ndjson().encode("utf-8")
        elif format == DataFormat.CSV:
            return df.write_csv().encode("utf-8")
        elif format == DataFormat.JSON:
            return df.write_json().encode("utf-8")
        else:
            raise ValueError(f"Streaming not supported for format: {format}")
    
    def _write_parquet(
        self, 
        df: pl.DataFrame, 
        path: str, 
        compression: Optional[str],
        partition_by: Optional[str]
    ) -> None:
        """Write DataFrame as Parquet."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        
        if partition_by and partition_by in df.columns:
            df.write_parquet(
                path,
                compression=compression or "zstd",
                partition_by=partition_by,
                partition_chunk_size_bytes=settings.export.partition_size_mb * 1024 * 1024
            )
        else:
            df.write_parquet(path, compression=compression or "zstd")
    
    def _write_csv(self, df: pl.DataFrame, path: str, compression: Optional[str]) -> None:
        """Write DataFrame as CSV."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        
        if compression == "gzip":
            import gzip
            with gzip.open(path + ".gz", "wt", encoding="utf-8") as f:
                f.write(df.write_csv())
        else:
            df.write_csv(path)
    
    def _write_tsv(self, df: pl.DataFrame, path: str, compression: Optional[str]) -> None:
        """Write DataFrame as TSV."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        df.write_csv(path, separator="\t")
    
    def _write_json(self, df: pl.DataFrame, path: str, compression: Optional[str]) -> None:
        """Write DataFrame as JSON."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        
        if compression == "gzip":
            import gzip
            with gzip.open(path + ".gz", "wt", encoding="utf-8") as f:
                f.write(df.write_json())
        else:
            df.write_json(path)
    
    def _write_jsonl(self, df: pl.DataFrame, path: str, compression: Optional[str]) -> None:
        """Write DataFrame as JSONL."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        
        if compression == "gzip":
            import gzip
            with gzip.open(path + ".gz", "wt", encoding="utf-8") as f:
                f.write(df.write_ndjson())
        else:
            df.write_ndjson(path)
    
    def _write_feather(self, df: pl.DataFrame, path: str, compression: Optional[str]) -> None:
        """Write DataFrame as Feather."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        df.write_ipc(path, compression=compression or "zstd")
    
    def _write_json_gz(self, df: pl.DataFrame, path: str) -> None:
        """Write DataFrame as gzipped JSONL."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(path, "wt", encoding="utf-8") as f:
            f.write(df.write_ndjson())
    
    def _apply_filter(self, lf: pl.LazyFrame, column: str, operator: str, value: Any) -> pl.LazyFrame:
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
    
    def _generate_output_path(self, name: str, format: DataFormat) -> str:
        """Generate output path for export."""
        output_dir = Path("./data_expert_exports")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        ext_map = {
            DataFormat.PARQUET: "parquet",
            DataFormat.CSV: "csv",
            DataFormat.TSV: "tsv",
            DataFormat.JSON: "json",
            DataFormat.JSONL: "jsonl",
            DataFormat.FEATHER: "feather",
            DataFormat.JSON_GZ: "json.gz",
        }
        ext = ext_map.get(format, "parquet")
        return str(output_dir / f"{name}_export.{ext}")
    
    def get_supported_formats(self) -> List[Dict[str, Any]]:
        """Get list of supported export formats with metadata."""
        return [
            {
                "format": DataFormat.PARQUET.value,
                "name": "Apache Parquet",
                "description": "Columnar format, efficient for analytics",
                "supports_compression": True,
                "supports_partitioning": True,
                "extensions": [".parquet", ".pq"],
            },
            {
                "format": DataFormat.CSV.value,
                "name": "CSV",
                "description": "Comma-separated values, universal compatibility",
                "supports_compression": True,
                "supports_partitioning": False,
                "extensions": [".csv"],
            },
            {
                "format": DataFormat.TSV.value,
                "name": "TSV",
                "description": "Tab-separated values",
                "supports_compression": True,
                "supports_partitioning": False,
                "extensions": [".tsv"],
            },
            {
                "format": DataFormat.JSON.value,
                "name": "JSON",
                "description": "JavaScript Object Notation",
                "supports_compression": True,
                "supports_partitioning": False,
                "extensions": [".json"],
            },
            {
                "format": DataFormat.JSONL.value,
                "name": "JSON Lines",
                "description": "Newline-delimited JSON, streaming friendly",
                "supports_compression": True,
                "supports_partitioning": False,
                "extensions": [".jsonl", ".ndjson"],
            },
            {
                "format": DataFormat.FEATHER.value,
                "name": "Feather",
                "description": "Fast, lightweight columnar format",
                "supports_compression": True,
                "supports_partitioning": False,
                "extensions": [".feather", ".ft"],
            },
            {
                "format": DataFormat.JSON_GZ.value,
                "name": "Gzipped JSONL",
                "description": "Compressed JSON Lines for storage efficiency",
                "supports_compression": False,
                "supports_partitioning": False,
                "extensions": [".json.gz"],
            },
        ]


export_engine = ExportEngine()