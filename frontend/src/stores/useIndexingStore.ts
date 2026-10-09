import { create } from "zustand"
import { api } from "@/lib/api"
import type { BrowseCopyStatus, DatasetFeatures, FeatureState, SearchIndexStatus } from "@/types"

export type FeatureKind = keyof DatasetFeatures

interface IndexingState {
  /** Search indexes being built (or that failed), by dataset id. */
  progress: Record<string, SearchIndexStatus>
  /** Search index and browse copy state of every loaded dataset, by id. */
  features: Record<string, DatasetFeatures>
  /** Latest browse copy status per dataset, with build progress. */
  browse: Record<string, BrowseCopyStatus>
  /** Load the states of every loaded dataset (on start and when the loaded datasets change). */
  loadAll: () => Promise<void>
  /** Re-read the given states of one dataset. */
  refresh: (id: string, kinds: FeatureKind[]) => Promise<void>
  applySearch: (id: string, status: SearchIndexStatus) => void
  applyBrowse: (id: string, status: BrowseCopyStatus) => void
}

const UNKNOWN: DatasetFeatures = { search: "not_needed", browse: "not_needed" }

export const useIndexingStore = create<IndexingState>((set, get) => ({
  progress: {},
  features: {},
  browse: {},
  loadAll: async () => {
    const [progress, features] = await Promise.allSettled([api.getIndexing(), api.getDatasetFeatures()])
    // keep the last known values while the backend is unavailable
    if (progress.status === "fulfilled") set({ progress: progress.value })
    if (features.status === "fulfilled") set({ features: features.value })
  },
  refresh: async (id, kinds) => {
    const [search, browse] = await Promise.allSettled([
      kinds.includes("search") ? api.getSearchStatus(id) : Promise.reject(),
      kinds.includes("browse") ? api.getBrowseCopy(id) : Promise.reject(),
    ])
    if (search.status === "fulfilled") get().applySearch(id, search.value)
    if (browse.status === "fulfilled") get().applyBrowse(id, browse.value)
  },
  applySearch: (id, status) =>
    set((s) => {
      const current = s.features[id] ?? UNKNOWN
      // the status endpoint does not know about files small enough to scan directly
      const state: FeatureState = status.state === "missing" && current.search === "not_needed" ? "not_needed" : status.state
      const progress = { ...s.progress }
      if (status.state === "building" || status.state === "error") progress[id] = status
      else delete progress[id]
      return { progress, features: { ...s.features, [id]: { ...current, search: state } } }
    }),
  applyBrowse: (id, status) =>
    set((s) => {
      const state: FeatureState = status.state === "missing" && !status.needed ? "not_needed" : status.state
      return {
        browse: { ...s.browse, [id]: status },
        features: { ...s.features, [id]: { ...(s.features[id] ?? UNKNOWN), browse: state } },
      }
    }),
}))
