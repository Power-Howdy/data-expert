import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Dataset, RowData, SortParams } from "@/types"
import { ColumnFilter } from "./filterOperators"

export function useBrowseData(dataset: Dataset | undefined) {
  const [rows, setRows] = React.useState<RowData[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(100)
  const [filters, setFilters] = React.useState<ColumnFilter[]>([])
  const [sorts] = React.useState<SortParams[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<RowData[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)

  const loadRows = React.useCallback(async () => {
    if (!dataset) return
    try {
      const result = await api.getRows(dataset.id, page * pageSize, pageSize, filters, sorts)
      setRows(result.rows)
      setTotal(result.total)
    } catch (error) {
      toast.error("Failed to load rows")
    }
  }, [dataset, page, pageSize, filters, sorts])

  React.useEffect(() => {
    loadRows()
  }, [loadRows])

  const search = async () => {
    if (!dataset || !searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const result = await api.search(dataset.id, searchQuery, { limit: 100 })
      setSearchResults(result.results.map((r: { row_id: string; data: Record<string, any> }) => ({ id: r.row_id, data: r.data })))
      setPage(0)
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

  return {
    rows, total, pageSize, changePageSize,
    filters, setFilters,
    searchQuery, setSearchQuery, searchResults, searchLoading, search,
  }
}
