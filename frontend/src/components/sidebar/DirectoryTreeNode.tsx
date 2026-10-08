import * as React from "react"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { DirectoryNode } from "@/types"
import { FileIcon } from "./FileIcon"

interface DirectoryTreeNodeProps {
  node: DirectoryNode
  depth?: number
  onSelect?: (file: DirectoryNode) => void
  selectedPath?: string
}

export function DirectoryTreeNode({ node, depth = 0, onSelect, selectedPath }: DirectoryTreeNodeProps) {
  const [expanded, setExpanded] = React.useState(depth < 2)
  const [loading, setLoading] = React.useState(false)

  const loadChildren = async () => {
    if (node.children && node.children.length > 0) return
    setLoading(true)
    try {
      const tree = await api.getDirectoryTree(node.path, 1)
      node.children = tree.children
    } catch (error) {
      toast.error("Failed to load directory")
    } finally {
      setLoading(false)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!node.is_directory) return onSelect?.(node)
    setExpanded(!expanded)
    if (expanded && (!node.children || node.children.length === 0)) loadChildren()
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors hover:bg-accent cursor-pointer",
          node.path === selectedPath && "bg-accent text-accent-foreground",
          depth > 0 && "pl-6"
        )}
        onClick={handleClick}
      >
        <span className="flex items-center justify-center w-5">
          <FileIcon node={node} expanded={expanded} />
        </span>
        <span className="truncate flex-1">{node.name}</span>
        {node.is_directory && loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      {expanded && node.children && (
        <div className="overflow-hidden transition-all">
          {node.children.map((child) => (
            <DirectoryTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}
