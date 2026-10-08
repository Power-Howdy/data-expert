import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { useDatasetStore } from "@/stores/useStore"
import { DirectoryNode } from "@/types"

export function useSidebar() {
  const store = useDatasetStore()
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    api.listDatasets(true).then(store.setDatasets).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scanPath = async (path: string) => {
    if (!path.trim()) return
    setLoading(true)
    try {
      store.setDirectoryTree(await api.getDirectoryTree(path, 3))
      store.setCurrentDirectory(path)
    } catch {
      toast.error("Failed to scan folder")
    } finally {
      setLoading(false)
    }
  }

  const pickFolder = async () => {
    setLoading(true)
    try {
      const { path } = await api.pickDirectory()
      await scanPath(path)
      toast.success("Folder loaded")
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      if (detail && detail !== "No folder selected") {
        toast.error(typeof detail === "string" ? detail : "Could not open folder picker")
      }
    } finally {
      setLoading(false)
    }
  }

  const loadDataset = async (file: DirectoryNode) => {
    try {
      toast.loading("Loading dataset...", { id: "load" })
      const dataset = await api.loadDataset(file.path)
      const exists = store.datasets.some((d) => d.id === dataset.id)
      if (!exists) store.addDataset(dataset)
      else store.setDatasets(store.datasets.map((d) => (d.id === dataset.id ? dataset : d)))
      store.selectDataset(dataset.id)
      toast.success("Dataset loaded!", { id: "load" })
    } catch {
      toast.error("Failed to load dataset", { id: "load" })
    }
  }

  return { store, loading, pickFolder, scanPath, loadDataset }
}
