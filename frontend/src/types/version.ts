import type { ColumnSchema, RowData } from "@/types"

export type CommitKind = "baseline" | "edit" | "restore" | "external"
export type UndoKind = "delta" | "snapshot" | "replay" | "none"
export type VersionFormat = "parquet" | "jsonl" | "csv" | "json"

export interface VersionStats {
  added: number
  updated: number
  deleted: number
  replaced: number
  transformed: number
}

export interface VersionCommit {
  id: string
  parent: string | null
  kind: CommitKind
  message: string
  author: string
  created_at: string
  row_count: number
  size_bytes: number
  columns: Array<{ name: string; type: string }>
  stats: VersionStats
  changes: string[]
  restored_from: string | null
  undo: UndoKind
}

export interface VersionInfo extends VersionCommit {
  head: boolean
  tags: string[]
  available: boolean
  storage_bytes: number
}

export interface VersionHistory {
  tracking: boolean
  head: string | null
  /** Newest first. */
  commits: VersionInfo[]
  keep_snapshots: number
  storage_bytes: number
  storage_path: string
}

export interface VersionRows {
  schema: ColumnSchema[]
  rows: RowData[]
  total: number
  offset: number
  limit: number
}

export interface RowDiff {
  compared_columns: string[]
  only_in_from: number
  only_in_to: number
  removed_sample: Array<Record<string, unknown>>
  added_sample: Array<Record<string, unknown>>
}

export interface VersionDiff {
  from_id: string
  to_id: string
  row_delta: number
  schema_changes: Array<{ name: string; before: string | null; after: string | null }>
  /** Commits after `from` up to `to`, oldest first. */
  commits: VersionInfo[]
  rows: RowDiff | null
}
