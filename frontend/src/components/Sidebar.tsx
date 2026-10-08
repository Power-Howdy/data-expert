"use client"
import * as React from "react"
import { useDatasetStore } from "@/stores/useStore"
import { api } from "@/lib/api"
import { DirectoryNode } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ChevronRight, ChevronDown, Folder, File, Database, RefreshCw, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"

interface DirectoryTreeProps {
  node: DirectoryNode
  depth?: number
  onSelect?: (file: DirectoryNode) => void
  selectedPath?: string
}

function DirectoryTreeNode({ node, depth = 0, onSelect, selectedPath }: DirectoryTreeProps) {
  const [expanded, setExpanded] = React.useState(depth < 2)
  const [loading, setLoading] = React.useState(false)

  const handleToggle = () => setExpanded(!expanded)

  const handleLoadChildren = async () => {
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
    if (!node.is_directory) {
      onSelect?.(node)
    } else {
      handleToggle()
      if (expanded && (!node.children || node.children.length === 0)) {
        handleLoadChildren()
      }
    }
  }

  const isSelected = node.path === selectedPath

  const icon = node.is_directory ? (
    expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
  ) : node.format === "parquet" ? (
    <Database className="h-4 w-4 text-yellow-500" />
  ) : (
    <File className="h-4 w-4 text-blue-500" />
  )

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors",
          "hover:bg-accent cursor-pointer",
          isSelected && "bg-accent text-accent-foreground",
          depth > 0 && "pl-6"
        )}
        onClick={handleClick}
      >
        {node.is_directory && <span onClick={handleToggle} className="flex items-center justify-center w-5">{icon}</span>}
        {!node.is_directory && <span className="w-5">{icon}</span>}
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

export function Sidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    directoryTree,
    currentDirectory,
    setDirectoryTree,
    setCurrentDirectory,
    datasets,
    selectDataset,
    selectedDatasetId,
  } = useDatasetStore()

  const [inputPath, setInputPath] = React.useState(currentDirectory)
  const [loading, setLoading] = React.useState(false)

  const handleScan = async () => {
    if (!inputPath.trim()) return
    setLoading(true)
    try {
      const tree = await api.getDirectoryTree(inputPath, 3)
      setDirectoryTree(tree)
      setCurrentDirectory(inputPath)
    } catch (error) {
      toast.error("Failed to scan directory")
    } finally {
      setLoading(false)
    }
  }

  const handleLoadDataset = async (file: DirectoryNode) => {
    try {
      toast.loading("Loading dataset...", { id: "load" })
      const dataset = await api.loadDataset(file.path)
      toast.success("Dataset loaded", { id: "load" })
      selectDataset(dataset.id)
    } catch (error) {
      toast.error("Failed to load dataset", { id: "load" })
    }
  }

  if (!sidebarOpen) {
    return (
      <Button
        className="fixed left-2 top-2 z-50 h-10 w-10 rounded-full shadow-lg"
        onClick={() => useDatasetStore.getState().setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <div className="fixed left-0 top-0 h-full border-r bg-card flex flex-col transition-width z-40" style={{ width: sidebarWidth }}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Data Expert</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => useDatasetStore.getState().setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 border-b space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Data Directory</label>
        <div className="flex gap-2">
          <Input
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Enter directory path..."
            className="flex-1"
          />
          <Button onClick={handleScan} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full p-2">
          {directoryTree ? (
            <>
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
                {directoryTree.name}
              </div>
              {directoryTree.children?.map((child) => (
                <DirectoryTreeNode
                  key={child.path}
                  node={child}
                  onSelect={handleLoadDataset}
                  selectedPath={currentDirectory}
                />
              ))}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Enter a directory path to browse files
            </div>
          )}
        </ScrollArea>
      </div>

      <Separator />
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase">
            Loaded Datasets ({datasets.length})
          </span>
        </div>
        <ScrollArea className="max-h-40">
          {datasets.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">No datasets loaded</div>
          ) : (
            <ul className="space-y-1">
              {datasets.map((dataset) => (
                <li key={dataset.id}>
                  <button
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-sm transition-colors",
                      "hover:bg-accent",
                      selectedDatasetId === dataset.id && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => selectDataset(dataset.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span className="truncate">{dataset.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dataset.row_count.toLocaleString()} rows · {dataset.format}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}