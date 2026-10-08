import { create } from "zustand"
import { api } from "@/lib/api"
import type { SearchIndexStatus } from "@/types"

interface IndexingState {
  /** Search indexes being built (or that failed), by dataset id. */
  progress: Record<string, SearchIndexStatus>
  refresh: () => Promise<void>
}

export const useIndexingStore = create<IndexingState>((set) => ({
  progress: {},
  refresh: async () => {
    try {
      set({ progress: await api.getIndexing() })
    } catch {
      // backend unavailable; keep the last known progress
    }
  },
}))
