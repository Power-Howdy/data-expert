import { ChevronDown, ChevronRight, Database, FileSpreadsheet, FileJson, File } from "lucide-react"
import { DirectoryNode } from "@/types"

export function FileIcon({ node, expanded }: { node: DirectoryNode; expanded: boolean }) {
  if (node.is_directory) {
    return expanded
      ? <ChevronDown className="h-4 w-4 text-primary" />
      : <ChevronRight className="h-4 w-4" />
  }
  if (node.format === "parquet" || node.format === "feather") {
    return <Database className="h-4 w-4 text-accent" />
  }
  if (node.format === "csv" || node.format === "tsv" || node.format === "xlsx" || node.format === "xls") {
    return <FileSpreadsheet className="h-4 w-4 text-primary" />
  }
  if (node.format === "json" || node.format === "jsonl" || node.format === "json.gz") {
    return <FileJson className="h-4 w-4 text-secondary" />
  }
  return <File className="h-4 w-4 text-muted-foreground" />
}
