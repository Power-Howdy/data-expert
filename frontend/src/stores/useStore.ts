import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Dataset, DirectoryNode, DataFormat } from "@/types"

interface DatasetState {
  datasets: Dataset[]
  selectedDatasetId: string | null
  sidebarOpen: boolean
  sidebarWidth: number
  directoryTree: DirectoryNode | null
  currentDirectory: string
  setDatasets: (datasets: Dataset[]) => void
  addDataset: (dataset: Dataset) => void
  removeDataset: (id: string) => void
  selectDataset: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  setDirectoryTree: (tree: DirectoryNode | null) => void
  setCurrentDirectory: (path: string) => void
  getSelectedDataset: () => Dataset | undefined
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      datasets: [],
      selectedDatasetId: null,
      sidebarOpen: true,
      sidebarWidth: 280,
      directoryTree: null,
      currentDirectory: "",
      
      setDatasets: (datasets) => set({ datasets }),
      addDataset: (dataset) => set((state) => ({ 
        datasets: [...state.datasets, dataset] 
      })),
      removeDataset: (id) => set((state) => ({ 
        datasets: state.datasets.filter((d) => d.id !== id),
        selectedDatasetId: state.selectedDatasetId === id ? null : state.selectedDatasetId,
      })),
      selectDataset: (id) => set({ selectedDatasetId: id }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setDirectoryTree: (tree) => set({ directoryTree: tree }),
      setCurrentDirectory: (path) => set({ currentDirectory: path }),
      getSelectedDataset: () => {
        const { datasets, selectedDatasetId } = get()
        return datasets.find((d) => d.id === selectedDatasetId)
      },
    }),
    {
      name: "data-expert-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        currentDirectory: state.currentDirectory,
      }),
    }
  )
)

interface UIState {
  theme: "light" | "dark"
  activeTab: string
  notifications: Array<{ id: string; message: string; type: "success" | "error" | "info" }>
  setTheme: (theme: "light" | "dark") => void
  toggleTheme: () => void
  setActiveTab: (tab: string) => void
  addNotification: (message: string, type: "success" | "error" | "info") => void
  removeNotification: (id: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "light",
      activeTab: "browse",
      notifications: [],
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setActiveTab: (tab) => set({ activeTab: tab }),
      addNotification: (message, type) => set((state) => ({
        notifications: [...state.notifications, { id: Date.now().toString(), message, type }]
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
      })),
    }),
    {
      name: "data-expert-ui",
    }
  )
)