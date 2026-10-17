import * as React from "react"
import toast from "react-hot-toast"
import { versionApi } from "@/lib/versionApi"
import { reloadDataset } from "@/lib/reloadDataset"
import { useEditStore } from "@/stores/useEditStore"
import type { VersionHistory } from "@/types/version"

/** Version history of a dataset plus the actions that change it. Refetches after every saved edit. */
export function useVersionHistory(datasetId: string | undefined) {
  const version = useEditStore((s) => s.version)
  const [history, setHistory] = React.useState<VersionHistory | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!datasetId) return setHistory(null)
    setLoading(true)
    try {
      setHistory(await versionApi.history(datasetId))
    } catch {
      setHistory(null)
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  React.useEffect(() => {
    load()
  }, [load, version])

  const run = async (key: string, action: () => Promise<VersionHistory | void>, message?: string) => {
    setBusy(key)
    try {
      const next = await action()
      if (next) setHistory(next)
      else await load()
      if (message) toast.success(message)
    } catch {
      // the API client shows the error
    } finally {
      setBusy(null)
    }
  }

  const id = datasetId ?? ""
  return {
    history,
    loading,
    busy,
    reload: load,
    start: () => run("start", () => versionApi.start(id), "Version tracking started"),
    restore: (ref: string) =>
      run(`restore:${ref}`, async () => {
        await versionApi.restore(id, ref)
        await reloadDataset(id)
      }, "Version restored; it is now the current file"),
    tag: (name: string, commitId: string) => run("tag", () => versionApi.tag(id, name, commitId), `Tagged ${name}`),
    untag: (name: string) => run("tag", () => versionApi.untag(id, name)),
    configure: (keep: number) => run("settings", () => versionApi.configure(id, keep), "History settings saved"),
    destroy: () => run("destroy", () => versionApi.destroy(id), "Version history deleted"),
  }
}

export type VersionHistoryState = ReturnType<typeof useVersionHistory>
