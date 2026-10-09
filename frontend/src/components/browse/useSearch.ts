import * as React from "react"
import { api } from "@/lib/api"
import { useIndexingStore } from "@/stores/useIndexingStore"
import type { RowData, SearchIndexStatus, SearchResponse } from "@/types"

const LIMIT = 100

/** Full-text search. Large files are searched through an index built on first use; while it builds, progress comes
 * from the indexing store and the search re-runs once the index is ready. */
export function useSearch(datasetId: string | undefined) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<RowData[]>([])
  const [total, setTotal] = React.useState(0)
  const [totalExact, setTotalExact] = React.useState(true)
  /** Wall time of the last search request, including the network, in milliseconds. */
  const [tookMs, setTookMs] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [indexing, setIndexing] = React.useState<SearchIndexStatus | null>(null)
  /** The query whose results are shown; null when not searching. */
  const [searched, setSearched] = React.useState<string | null>(null)
  const pending = React.useRef<string | null>(null)

  const reset = React.useCallback(() => {
    setQuery("")
    setResults([])
    setTotal(0)
    setTotalExact(true)
    setTookMs(null)
    setIndexing(null)
    setSearched(null)
    pending.current = null
  }, [])

  React.useEffect(reset, [datasetId, reset])

  const run = React.useCallback(async (text: string) => {
    if (!datasetId || !text.trim()) return
    setLoading(true)
    try {
      const started = performance.now()
      const response: SearchResponse = await api.search(datasetId, text, { limit: LIMIT })
      setTookMs(performance.now() - started)
      const building = response.index && response.index.state !== "ready"
      setIndexing(building ? response.index! : null)
      if (response.index) useIndexingStore.getState().applySearch(datasetId, response.index)
      pending.current = building ? text : null
      setResults(response.results.map((r) => ({ id: r.row_id, data: r.data })))
      setTotal(response.total)
      setTotalExact(response.total_exact)
      setSearched(text.trim())
    } catch {
      pending.current = null
      setIndexing(null)
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  // the indexing store polls the build; follow it and re-run the query once the index is ready
  const indexState = useIndexingStore((s) => (datasetId ? s.features[datasetId]?.search : undefined))
  const progress = useIndexingStore((s) => (datasetId ? s.progress[datasetId] : undefined))
  React.useEffect(() => {
    if (indexing?.state !== "building") return
    if (indexState === "ready") {
      if (pending.current) run(pending.current)
      else setIndexing(null)
    } else if (progress) {
      setIndexing(progress)
    }
  }, [indexing?.state, indexState, progress, run])

  const changeQuery = (value: string) => {
    if (value.trim()) setQuery(value)
    else reset()
  }

  return { query, setQuery: changeQuery, results, total, totalExact, tookMs, loading, indexing, searched, search: () => run(query), clear: reset }
}
