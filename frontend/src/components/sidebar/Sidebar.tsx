import * as React from "react"
import toast from "react-hot-toast"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { useDatasetStore } from "@/stores/useStore"
import { DirectoryNode } from "@/types"
import { DirectoryScanInput } from "./DirectoryScanInput"
import { DirectoryTreeView } from "./DirectoryTreeView"
import { LoadedDatasetsList } from "./LoadedDatasetsList"

export function Sidebar() {
  const store = useDatasetStore()
  const [inputPath, setInputPath] = React.useState(store.currentDirectory)
  const [loading, setLoading] = React.useState(false)

  const handleScan = async () => {
    if (!inputPath.trim()) return
    setLoading(true)
    try {
      store.setDirectoryTree(await api.getDirectoryTree(inputPath, 3))
      store.setCurrentDirectory(inputPath)
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
      store.selectDataset(dataset.id)
    } catch (error) {
      toast.error("Failed to load dataset", { id: "load" })
    }
  }

  if (!store.sidebarOpen) {
    return (
      <Button
        className="fixed left-2 top-2 z-50 h-10 w-10 rounded-full shadow-lg"
        onClick={() => store.setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <div className="fixed left-0 top-0 h-full border-r bg-card flex flex-col transition-width z-40" style={{ width: store.sidebarWidth }}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Data Expert</h2>
        <Button variant="ghost" size="icon" onClick={() => store.setSidebarOpen(false)} aria-label="Close sidebar">
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
      <DirectoryScanInput value={inputPath} onChange={setInputPath} onScan={handleScan} loading={loading} />
      <DirectoryTreeView tree={store.directoryTree} selectedPath={store.currentDirectory} onSelectFile={handleLoadDataset} />
      <Separator />
      <LoadedDatasetsList datasets={store.datasets} selectedId={store.selectedDatasetId} onSelect={store.selectDataset} />
    </div>
  )
}
