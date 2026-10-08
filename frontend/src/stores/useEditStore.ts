import { create } from "zustand"
import { editApi, type ChangesSummary } from "@/lib/editApi"

interface EditState {
  /** Bumped after every edit so row lists refetch. */
  version: number
  changes: Record<string, ChangesSummary | undefined>
  refresh: (datasetId: string) => Promise<void>
  edited: (datasetId: string) => Promise<void>
}

export const useEditStore = create<EditState>((set) => ({
  version: 0,
  changes: {},
  refresh: async (datasetId) => {
    try {
      const summary = await editApi.getChanges(datasetId)
      set((s) => ({ changes: { ...s.changes, [datasetId]: summary } }))
    } catch {
      // dataset may have been unloaded
    }
  },
  edited: async (datasetId) => {
    set((s) => ({ version: s.version + 1 }))
    await useEditStore.getState().refresh(datasetId)
  },
}))
