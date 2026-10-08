import { create } from "zustand"
import { api } from "@/lib/api"
import type { DatasetFeatures, SearchIndexStatus } from "@/types"

interface IndexingState {
  /** Search indexes being built (or that failed), by dataset id. */
  progress: Record<string, SearchIndexStatus>
  /** Search index and browse copy state of every loaded dataset, by id. */
  features: Record<string, DatasetFeatures>
  refresh: () => Promise<void>
}

export const useIndexingStore = create<IndexingState>((set) => ({
  progress: {},
  features: {},
  refresh: async () => {
    const [progress, features] = await Promise.allSettled([api.getIndexing(), api.getDatasetFeatures()])
    // keep the last known values while the backend is unavailable
    if (progress.status === "fulfilled") set({ progress: progress.value })
    if (features.status === "fulfilled") set({ features: features.value })
  },
}))
