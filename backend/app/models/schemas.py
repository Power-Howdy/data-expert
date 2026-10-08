from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class DataFormat(str, Enum):
    PARQUET = "parquet"
    JSON = "json"
    JSONL = "jsonl"
    JSON_GZ = "json.gz"
    CSV = "csv"
    TSV = "tsv"
    FEATHER = "feather"
    AVRO = "avro"
    ORC = "orc"
    XLSX = "xlsx"
    XLS = "xls"


class DataType(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATETIME = "datetime"
    DATE = "date"
    TIME = "time"
    BINARY = "binary"
    LIST = "list"
    STRUCT = "struct"
    NULL = "null"
    UNKNOWN = "unknown"


class ColumnSchema(BaseModel):
    name: str
    type: DataType
    nullable: bool = True
    unique_count: Optional[int] = None
    null_count: Optional[int] = None
    stats: Optional[Dict[str, Any]] = None


class DatasetStats(BaseModel):
    row_count: int
    column_count: int
    memory_bytes: int
    missing_percentage: float
    duplicate_rows: int


class Dataset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    path: str
    format: DataFormat
    schema: List[ColumnSchema] = []
    stats: Optional[DatasetStats] = None
    row_count: int = 0
    size_bytes: int = 0
    loaded_at: datetime = Field(default_factory=datetime.now)
    last_modified: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = {}


class DirectoryNode(BaseModel):
    name: str
    path: str
    is_directory: bool
    children: Optional[List["DirectoryNode"]] = None
    size: Optional[int] = None
    format: Optional[DataFormat] = None
    modified: Optional[datetime] = None


DirectoryNode.model_rebuild()


class ScanRequest(BaseModel):
    path: str
    recursive: bool = True
    max_depth: Optional[int] = None


class ScanResponse(BaseModel):
    root: DirectoryNode
    total_files: int
    total_size: int
    data_files: List[DirectoryNode]


class LoadDatasetRequest(BaseModel):
    path: str
    name: Optional[str] = None
    format: Optional[DataFormat] = None
    options: Dict[str, Any] = {}


class PaginationParams(BaseModel):
    offset: int = 0
    limit: int = 100


class SortParams(BaseModel):
    column: str
    ascending: bool = True


class FilterParams(BaseModel):
    column: str
    operator: str
    value: Any


class FilterRequest(BaseModel):
    filters: List[FilterParams]
    logic: str = "AND"


class SortRequest(BaseModel):
    sorts: List[SortParams]


class SearchRequest(BaseModel):
    query: str
    columns: Optional[List[str]] = None
    limit: int = 100
    offset: int = 0
    fuzzy: bool = True


class SearchResult(BaseModel):
    row_id: str
    score: float
    highlights: Dict[str, List[str]]
    data: Dict[str, Any]


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    took_ms: float


class RowData(BaseModel):
    id: str
    data: Dict[str, Any]


class RowsResponse(BaseModel):
    rows: List[RowData]
    total: int
    offset: int
    limit: int


class AddRowRequest(BaseModel):
    data: Dict[str, Any]


class UpdateRowRequest(BaseModel):
    data: Dict[str, Any]


class ReplaceRequest(BaseModel):
    column: str
    old_value: Any
    new_value: Any
    case_sensitive: bool = True


class TransformRequest(BaseModel):
    operations: List[Dict[str, Any]]


class CombineRequest(BaseModel):
    dataset_ids: List[str]
    strategy: str = "concat"
    join_config: Optional[Dict[str, Any]] = None
    output_name: str
    output_format: DataFormat = DataFormat.PARQUET


class SeparateRequest(BaseModel):
    dataset_id: str
    column: str
    output_dir: str
    output_format: DataFormat = DataFormat.PARQUET


class ExportRequest(BaseModel):
    dataset_id: str
    format: DataFormat
    columns: Optional[List[str]] = None
    filters: Optional[List[FilterParams]] = None
    compression: Optional[str] = None
    partition_by: Optional[str] = None
    output_path: Optional[str] = None


class ColumnProfile(BaseModel):
    name: str
    type: DataType
    count: int
    null_count: int
    null_percentage: float
    unique_count: int
    unique_percentage: float
    min: Optional[Any] = None
    max: Optional[Any] = None
    mean: Optional[float] = None
    std: Optional[float] = None
    median: Optional[float] = None
    quantiles: Optional[Dict[str, float]] = None
    top_values: Optional[List[Dict[str, Any]]] = None
    histogram: Optional[Dict[str, Any]] = None


class DatasetProfile(BaseModel):
    dataset_id: str
    row_count: int
    column_count: int
    memory_bytes: int
    columns: List[ColumnProfile]
    correlations: Optional[Dict[str, Dict[str, float]]] = None
    missing_matrix: Optional[Dict[str, Dict[str, int]]] = None


class AnalyticsOverview(BaseModel):
    dataset_id: str
    row_count: int
    column_count: int
    memory_bytes: int
    missing_percentage: float
    duplicate_rows: int
    column_types: Dict[str, int]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None