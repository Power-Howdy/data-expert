import * as React from "react"
import { api } from "@/lib/api"
import { useIndexingStore } from "@/stores/useIndexingStore"
import type { BrowseCopyStatus, Dataset } from "@/types"

const POLL_MS = 1500
const DISMISSED_KEY = "dx-browse-copy-dismissed"

function dismissedPaths(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")
  } catch {
    return []
  }
}

/** The dataset's optional browse copy (small row groups for fast paging): status, progress and actions. */
export function useBrowseCopy(dataset: Dataset | undefined) {
  const [status, setStatus] = React.useState<BrowseCopyStatus | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [dismissed, setDismissed] = React.useState(false)
  const id = dataset?.id
  const path = dataset?.path

  React.useEffect(() => {
    setStatus(null)
    setDismissed(!!path && dismissedPaths().includes(path))
    if (!id) return
    let active = true
    api.getBrowseCopy(id).then((s) => active && setStatus(s)).catch(() => undefined)
    return () => {
      active = false
    }
  }, [id, path, dataset?.last_modified])

  React.useEffect(() => {
    if (!id || status?.state !== "building") return
    const timer = window.setInterval(() => {
      api.getBrowseCopy(id).then(setStatus).catch(() => setStatus(null))
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [id, status?.state])

  const run = async (action: (datasetId: string) => Promise<BrowseCopyStatus>) => {
    if (!id) return
    setBusy(true)
    try {
      setStatus(await action(id))
    } catch {
      // the API client shows the error
    } finally {
      setBusy(false)
      useIndexingStore.getState().refresh()
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
