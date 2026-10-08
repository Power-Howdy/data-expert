import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Dataset, RowData, SortParams } from "@/types"
import { ColumnFilter } from "./filterOperators"

export function useBrowseData(dataset: Dataset | undefined) {
  const [rows, setRows] = React.useState<RowData[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(100)
  const [filters, setFilters] = React.useState<ColumnFilter[]>([])
  const [sorts] = React.useState<SortParams[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<RowData[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const requestId = React.useRef(0)
  const datasetId = dataset?.id

  React.useEffect(() => {
    setRows([])
    setTotal(dataset?.row_count ?? 0)
    setPage(0)
    setFilters([])
    setSearchQuery("")
    setSearchResults([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId])

  React.useEffect(() => {
    if (!datasetId) return
    const id = ++requestId.current
    setLoading(true)
    api.getRows(datasetId, page * pageSize, pageSize, filters, sorts)
      .then((result) => {
        if (id !== requestId.current) return
        setRows(result.rows)
        setTotal(result.total)
      })
      .catch(() => id === requestId.current && toast.error("Failed to load rows"))
      .finally(() => id === requestId.current && setLoading(false))
  }, [datasetId, page, pageSize, filters, sorts])

  const search = async () => {
    if (!dataset || !searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const result = await api.search(dataset.id, searchQuery, { limit: 100 })
      setSearchResults(result.results.map((r: { row_id: string; data: Record<string, any> }) => ({ id: r.row_id, data: r.data })))
    } catch (error) {
      toast.error("Search failed")
    } finally {
      setSearchLoading(false)
    }
  }

  const changePageSize = (size: number) => {
    setPageSize(size)
    setPage(0)
  }

  const changeFilters = (next: ColumnFilter[]) => {
    setFilters(next)
    setPage(0)
  }

  const changeSearchQuery = (value: string) => {
    setSearchQuery(value)
    if (!value.trim()) setSearchResults([])
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return {
    rows, total, loading, page, setPage, pageCount, pageSize, changePageSize,
    filters, setFilters: changeFilters,
    searchQuery, setSearchQuery: changeSearchQuery, searchResults, searchLoading, search,
  }
}
