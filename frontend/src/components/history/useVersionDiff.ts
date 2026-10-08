import * as React from "react"
import { versionApi } from "@/lib/versionApi"
import type { VersionDiff } from "@/types/version"

/** Comparison of two versions; the row-level comparison scans both versions, so it runs only on request. */
export function useVersionDiff(datasetId: string, a: string, b: string) {
  const [diff, setDiff] = React.useState<VersionDiff | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [comparingRows, setComparingRows] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    versionApi
      .diff(datasetId, a, b)
      .then((result) => !cancelled && setDiff(result))
      .catch(() => !cancelled && setDiff(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [datasetId, a, b])

  const compareRows = async () => {
    setComparingRows(true)
    try {
      setDiff(await versionApi.diff(datasetId, a, b, true))
    } catch {
      // the API client shows the error
    } finally {
      setComparingRows(false)
    }
  }

  return { diff, loading, comparingRows, compareRows }
}
