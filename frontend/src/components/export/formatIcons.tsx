import * as React from "react"
import { Database, FileCode, FileSpreadsheet } from "lucide-react"
import { DataFormat } from "@/types"

export const formatIcons: Record<DataFormat, React.ReactNode> = {
  parquet: <Database className="h-4 w-4" />,
  csv: <FileSpreadsheet className="h-4 w-4" />,
  tsv: <FileSpreadsheet className="h-4 w-4" />,
  json: <FileCode className="h-4 w-4" />,
  jsonl: <FileCode className="h-4 w-4" />,
  feather: <Database className="h-4 w-4" />,
  avro: <Database className="h-4 w-4" />,
  orc: <Database className="h-4 w-4" />,
  "json.gz": <FileCode className="h-4 w-4" />,
  xlsx: <FileSpreadsheet className="h-4 w-4" />,
  xls: <FileSpreadsheet className="h-4 w-4" />,
}

export interface ExportFormatInfo {
  format: DataFormat
  name: string
  description: string
  supports_compression: boolean
  supports_partitioning: boolean
  extensions: string[]
}

export interface ExportHistoryEntry {
  id: string
  format: DataFormat
  timestamp: string
  rows: number
  path: string
}
