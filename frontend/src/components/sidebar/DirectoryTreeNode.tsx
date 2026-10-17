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
  const [expanded, setExpanded] = React.useState(depth < 1)
  const [loading, setLoading] = React.useState(false)
  const [children, setChildren] = React.useState(node.children)

  const loadChildren = async () => {
    if (children && children.length > 0) return
    setLoading(true)
    try {
      const tree = await api.getDirectoryTree(node.path, 1)
      setChildren(tree.children)
      node.children = tree.children
    } catch {
      toast.error("Failed to load folder")
    } finally {
      setLoading(false)
    }
  }

  const handleClick = async () => {
    if (!node.is_directory) {
      onSelect?.(node)
      return
    }
    const next = !expanded
    setExpanded(next)
    if (next) await loadChildren()
  }

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1.5 rounded-xl px-2 py-2 text-left text-sm font-bold transition-colors",
          "hover:bg-muted",
          node.path === selectedPath && "bg-primary/10 text-primary",
          !node.is_directory && "hover:bg-secondary/10"
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleClick}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          <FileIcon node={node} expanded={expanded} />
        </span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {node.is_directory && loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
      </button>
      {expanded && children && (
        <div>
          {children.map((child) => (
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
