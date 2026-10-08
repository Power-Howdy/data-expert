from enum import Enum
from typing import Optional, List, Dict, Any, Literal, Union
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
    """Cheap facts gathered when a file is opened. None means too costly to compute without scanning a large file."""
    row_count: int
    column_count: int
    memory_bytes: int
    missing_percentage: Optional[float] = None
    duplicate_rows: Optional[int] = None


class Dataset(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    path: str
    format: DataFormat
    columns_schema: List[ColumnSchema] = Field(default_factory=list, alias="schema")
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


class SearchIndexStatus(BaseModel):
    state: Literal["missing", "building", "ready", "error"]
    indexed: int = 0
    total: int = 0
    size_bytes: int = 0
    error: Optional[str] = None


class BrowseCopyStatus(BaseModel):
    state: Literal["missing", "building", "ready", "error"]
    needed: bool = False
    done: int = 0
    total: int = 0
    size_bytes: int = 0
    error: Optional[str] = None


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    took_ms: float
    mode: Literal["scan", "index"] = "scan"
    index: Optional[SearchIndexStatus] = Field(None, description="Set for large files, which are searched through an index")


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
    new_value: Any = None
    case_sensitive: bool = True
    mode: Literal["exact", "contains", "regex"] = "exact"


class TransformRequest(BaseModel):
    """Function-library steps: [{"op": "<function name>", "params": {...}}, ...]."""
    operations: List[Dict[str, Any]]
    description: str = ""


class ChangeItem(BaseModel):
    type: str
    label: str


class ChangesSummary(BaseModel):
    total: int = 0
    added: int = 0
    updated: int = 0
    deleted: int = 0
    replaced: int = 0
    transformed: int = 0
    items: List[ChangeItem] = []


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
    generated_at: datetime = Field(default_factory=datetime.now)
    sampled: bool = False


class AnalyticsOverview(BaseModel):
    dataset_id: str
    row_count: int
    column_count: int
    memory_bytes: int
    missing_percentage: Optional[float] = None
    duplicate_rows: Optional[int] = None
    column_types: Dict[str, int]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None