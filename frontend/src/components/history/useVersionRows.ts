import * as React from "react"
import { versionApi } from "@/lib/versionApi"
import type { VersionRows } from "@/types/version"

const PAGE_SIZE = 50

/** One page of rows of an old version, rebuilt on the server. */
export function useVersionRows(datasetId: string, ref: string) {
  const [page, setPage] = React.useState(0)
  const [data, setData] = React.useState<VersionRows | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    versionApi
      .rows(datasetId, ref, page * PAGE_SIZE, PAGE_SIZE)
      .then((result) => !cancelled && (setData(result), setError(null)))
      .catch(() => !cancelled && setError("Could not load this version"))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [datasetId, ref, page])

  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  return { data, loading, error, page, setPage, pageCount, pageSize: PAGE_SIZE }
}
