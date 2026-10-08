import * as React from "react"
import { api } from "@/lib/api"
import { useIndexingStore } from "@/stores/useIndexingStore"
import type { RowData, SearchIndexStatus, SearchResponse } from "@/types"

const POLL_MS = 1500
const LIMIT = 100

/** Full-text search. Large files are searched through an index built on first use; while it builds, progress is
 * polled and the search re-runs once the index is ready. */
export function useSearch(datasetId: string | undefined) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<RowData[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [indexing, setIndexing] = React.useState<SearchIndexStatus | null>(null)
  /** The query whose results are shown; null when not searching. */
  const [searched, setSearched] = React.useState<string | null>(null)
  const pending = React.useRef<string | null>(null)

  const reset = React.useCallback(() => {
    setQuery("")
    setResults([])
    setTotal(0)
    setIndexing(null)
    setSearched(null)
    pending.current = null
  }, [])

  React.useEffect(reset, [datasetId, reset])

  const run = React.useCallback(async (text: string) => {
    if (!datasetId || !text.trim()) return
    setLoading(true)
    try {
      const response: SearchResponse = await api.search(datasetId, text, { limit: LIMIT })
      const building = response.index && response.index.state !== "ready"
      setIndexing(building ? response.index! : null)
      if (building) useIndexingStore.getState().refresh()
      pending.current = building ? text : null
      setResults(response.results.map((r) => ({ id: r.row_id, data: r.data })))
      setTotal(response.total)
      setSearched(text.trim())
    } catch {
      pending.current = null
      setIndexing(null)
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  React.useEffect(() => {
    if (!datasetId || indexing?.state !== "building") return
    const timer = window.setInterval(async () => {
      try {
        const status = await api.getSearchStatus(datasetId)
        if (status.state === "ready" && pending.current) run(pending.current)
        else setIndexing(status.state === "ready" ? null : status)
      } catch {
        setIndexing(null)
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [datasetId, indexing?.state, run])

  const changeQuery = (value: string) => {
    if (value.trim()) setQuery(value)
    else reset()
  }

  return { query, setQuery: changeQuery, results, total, loading, indexing, searched, search: () => run(query), clear: reset }
}
