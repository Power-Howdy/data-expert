export type DataFormat = 
  | "parquet" 
  | "json" 
  | "jsonl" 
  | "json.gz" 
  | "csv" 
  | "tsv" 
  | "feather" 
  | "avro" 
  | "orc" 
  | "xlsx" 
  | "xls"

export type DataType = 
  | "string" 
  | "integer" 
  | "float" 
  | "boolean" 
  | "datetime" 
  | "date" 
  | "time" 
  | "binary" 
  | "list" 
  | "struct" 
  | "null" 
  | "unknown"

export interface ColumnSchema {
  name: string
  type: DataType
  nullable: boolean
  unique_count?: number
  null_count?: number
  stats?: Record<string, any>
}

export interface DatasetStats {
  row_count: number
  column_count: number
  memory_bytes: number
  missing_percentage: number | null
  duplicate_rows: number | null
}

export interface Dataset {
  id: string
  name: string
  path: string
  format: DataFormat
  schema: ColumnSchema[]
  stats?: DatasetStats
  row_count: number
  size_bytes: number
  loaded_at: string
  last_modified: string
  metadata: Record<string, any>
}

export interface DirectoryNode {
  name: string
  path: string
  is_directory: boolean
  children?: DirectoryNode[]
  size?: number
  format?: DataFormat
  modified?: string
}

export interface ScanResponse {
  root: DirectoryNode
  total_files: number
  total_size: number
  data_files: DirectoryNode[]
}

export interface RowData {
  id: string
  data: Record<string, any>
}

export interface RowsResponse {
  rows: RowData[]
  total: number
  offset: number
  limit: number
}

export interface FilterParams {
  column: string
  operator: string
  value: any
}

export interface SortParams {
  column: string
  ascending: boolean
}

export interface SearchResult {
  row_id: string
  score: number
  highlights: Record<string, string[]>
  data: Record<string, any>
}

export interface SearchIndexStatus {
  state: "missing" | "building" | "ready" | "error"
  indexed: number
  total: number
  size_bytes: number
  error: string | null
}

/** A copy of the file with small row groups, so any page loads quickly. */
export interface BrowseCopyStatus {
  state: "missing" | "building" | "ready" | "error"
  /** Whether deep pages are slow without a copy. */
  needed: boolean
  done: number
  total: number
  size_bytes: number
  error: string | null
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  /** False when counting stopped early on a large file; `total` is then a lower bound. */
  total_exact: boolean
  took_ms: number
  mode: "scan" | "index"
  /** Set for large files, which are searched through an index. */
  index: SearchIndexStatus | null
}

export interface AnalyticsOverview {
  dataset_id: string
  row_count: number
  column_count: number
  memory_bytes: number
  missing_percentage: number | null
  duplicate_rows: number | null
  column_types: Record<string, number>
}

export interface ColumnProfile {
  name: string
  type: DataType
  count: number
  null_count: number
  null_percentage: number
  unique_count: number
  unique_percentage: number
  min?: number
  max?: number
  mean?: number
  std?: number
  median?: number
  quantiles?: Record<string, number>
  top_values?: Array<{ value: any; count: number }>
  histogram?: {
    bins: number[]
    bin_edges: number[]
  }
}

export interface DatasetProfile {
  dataset_id: string
  row_count: number
  column_count: number
  memory_bytes: number
  columns: ColumnProfile[]
  correlations?: Record<string, Record<string, number>>
  missing_matrix?: Record<string, Record<string, number>>
  generated_at?: string
  sampled?: boolean
}

export interface CombineRequest {
  dataset_ids: string[]
  strategy: "concat" | "join" | "merge"
  join_config?: Record<string, any>
  output_name: string
  output_format: DataFormat
}

export interface SeparateRequest {
  dataset_id: string
  column: string
  output_dir: string
  output_format: DataFormat
}

export interface ExportRequest {
  dataset_id: string
  format: DataFormat
  columns?: string[]
  filters?: FilterParams[]
  compression?: string
  partition_by?: string
  output_path?: string
}