import * as React from "react"
import toast from "react-hot-toast"
import { editApi } from "@/lib/editApi"
import { reloadDataset } from "@/lib/reloadDataset"
import { useEditStore } from "@/stores/useEditStore"

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
    } catch (error) {
      if (kind === "commit") throw error
      // the API client shows the error
    } finally {
      await edited(datasetId)
      setBusy(null)
    }
  }

  return {
    summary,
    busy,
    undo: () => run("undo", () => editApi.undo(datasetId), "Last change undone"),
    discard: () => run("discard", () => editApi.discard(datasetId), "All pending changes discarded"),
    commit: (message: string) =>
      run("commit", async () => {
        await editApi.commit(datasetId, message)
        await reloadDataset(datasetId)
      }, "Saved to file as a new version"),
  }
}
