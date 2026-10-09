import * as React from "react"
import { api } from "@/lib/api"
import { useIndexingStore } from "@/stores/useIndexingStore"
import type { BrowseCopyStatus, Dataset } from "@/types"

const DISMISSED_KEY = "dx-browse-copy-dismissed"

function dismissedPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")
  } catch {
    return []
  }
}

/** The dataset's optional browse copy (small batches for fast paging): status, progress and actions. Build
 * progress is polled by the indexing store. */
export function useBrowseCopy(dataset: Dataset | undefined) {
  const id = dataset?.id
  const path = dataset?.path
  const status = useIndexingStore((s) => (id ? s.browse[id] ?? null : null))
  const [busy, setBusy] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    setDismissed(!!path && dismissedPaths().includes(path))
    if (id) useIndexingStore.getState().refresh(id, ["browse"])
  }, [id, path, dataset?.last_modified])

  const run = async (action: (datasetId: string) => Promise<BrowseCopyStatus>) => {
    if (!id) return
    setBusy(true)
    try {
      useIndexingStore.getState().applyBrowse(id, await action(id))
    } catch {
      // the API client shows the error
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    if (!path) return
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedPaths(), path]))
    setDismissed(true)
  }

  return {
    status,
    busy,
    dismissed,
    onBuild: () => run((datasetId) => api.buildBrowseCopy(datasetId)),
    onRemove: () => run((datasetId) => api.deleteBrowseCopy(datasetId)),
    onDismiss: dismiss,
  }
}
