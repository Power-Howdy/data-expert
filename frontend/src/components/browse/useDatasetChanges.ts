import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { editApi } from "@/lib/editApi"
import { useEditStore } from "@/stores/useEditStore"
import { useDatasetStore } from "@/stores/useStore"

/** Pending (unsaved) edits of a dataset plus the actions to undo, discard or write them. */
export function useDatasetChanges(datasetId: string) {
  const summary = useEditStore((s) => s.changes[datasetId])
  const edited = useEditStore((s) => s.edited)
  const [busy, setBusy] = React.useState<"undo" | "discard" | "commit" | null>(null)

  const run = async (kind: "undo" | "discard" | "commit", action: () => Promise<unknown>, message: string) => {
    setBusy(kind)
    try {
      await action()
      toast.success(message)
    } catch {
      // the API client shows the error
    } finally {
      await edited(datasetId)
      setBusy(null)
    }
  }

  const reloadDataset = async () => {
    const fresh = await api.getDataset(datasetId)
    const store = useDatasetStore.getState()
    store.setDatasets(store.datasets.map((d) => (d.id === datasetId ? fresh : d)))
  }

  return {
    summary,
    busy,
    undo: () => run("undo", () => editApi.undo(datasetId), "Last change undone"),
    discard: () => run("discard", () => editApi.discard(datasetId), "All pending changes discarded"),
    commit: () =>
      run("commit", async () => {
        await editApi.commit(datasetId)
        await reloadDataset()
      }, "Changes saved to file"),
  }
}
