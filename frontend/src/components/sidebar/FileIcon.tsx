import { ChevronDown, ChevronRight, Database, File } from "lucide-react"
import { DirectoryNode } from "@/types"

export function FileIcon({ node, expanded }: { node: DirectoryNode; expanded: boolean }) {
  if (node.is_directory) {
    return expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
  }
  if (node.format === "parquet") return <Database className="h-4 w-4 text-yellow-500" />
  return <File className="h-4 w-4 text-blue-500" />
}
