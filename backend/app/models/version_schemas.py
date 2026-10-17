from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.schemas import ColumnSchema, RowData

CommitKind = Literal["baseline", "edit", "restore", "external"]
# How a commit's parent version is rebuilt from it:
#   delta    reverse delta (deleted rows + old cell values), a few KB for row edits
#   snapshot full copy of the parent (hardlink of the replaced file); needed for transforms
#   replay   re-run the forward edits listed in undo_meta["replay"] (used by restores)
#   none     baseline, or a change made outside the app (the previous content is gone)
UndoKind = Literal["delta", "snapshot", "replay", "none"]


class VersionColumn(BaseModel):
    name: str
    type: str


class VersionStats(BaseModel):
    added: int = 0
    updated: int = 0
    deleted: int = 0
    replaced: int = 0
    transformed: int = 0


class VersionCommit(BaseModel):
    id: str
    parent: Optional[str] = None
    kind: CommitKind
    message: str
    author: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    row_count: int = 0
    size_bytes: int = 0
    columns: List[VersionColumn] = Field(default_factory=list)
    stats: VersionStats = Field(default_factory=VersionStats)
    changes: List[str] = Field(default_factory=list, description="First change labels, for display")
    restored_from: Optional[str] = None
    fingerprint: str = ""
    undo: UndoKind = "none"
    undo_meta: Dict[str, Any] = Field(default_factory=dict)


class VersionInfo(VersionCommit):
    """A commit as shown to clients."""
    head: bool = False
    tags: List[str] = Field(default_factory=list)
    available: bool = True
    storage_bytes: int = 0


class VersionHistory(BaseModel):
    tracking: bool
    head: Optional[str] = None
    commits: List[VersionInfo] = Field(default_factory=list, description="Newest first")
    keep_snapshots: int = 5
    storage_bytes: int = 0
    storage_path: str = ""


class CommitRequest(BaseModel):
    message: str = ""


class TagRequest(BaseModel):
    name: str
    commit_id: str


class VersionSettingsRequest(BaseModel):
    keep_snapshots: int = Field(ge=0, le=100)


class SaveVersionRequest(BaseModel):
    name: str
    format: Literal["parquet", "jsonl", "csv", "json"] = "parquet"
    overwrite: bool = False


class SchemaChange(BaseModel):
    name: str
    before: Optional[str] = None
    after: Optional[str] = None


class RowDiff(BaseModel):
    compared_columns: List[str]
    only_in_from: int
    only_in_to: int
    removed_sample: List[Dict[str, Any]] = Field(default_factory=list)
    added_sample: List[Dict[str, Any]] = Field(default_factory=list)


class VersionRows(BaseModel):
    columns_schema: List[ColumnSchema] = Field(alias="schema")
    rows: List[RowData]
    total: int
    offset: int
    limit: int

    model_config = {"populate_by_name": True}


class VersionDiff(BaseModel):
    from_id: str
    to_id: str
    row_delta: int
    schema_changes: List[SchemaChange] = Field(default_factory=list)
    commits: List[VersionInfo] = Field(default_factory=list, description="Commits after `from` up to `to`, oldest first")
    rows: Optional[RowDiff] = None
