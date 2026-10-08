"use client"
import * as React from "react"
import { useDatasetStore } from "@/stores/useStore"
import { api } from "@/lib/api"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, Filter, ChevronDown, ChevronUp, Download, Plus, Trash2, Edit2 } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"
import { Dataset, ColumnSchema, RowData, FilterParams, SortParams } from "@/types"
import toast from "react-hot-toast"

interface ColumnFilter {
  column: string
  operator: string
  value: any
}

const operators = [
  { value: "eq", label: "Equals" },
  { value: "ne", label: "Not Equals" },
  { value: "gt", label: "Greater Than" },
  { value: "gte", label: "Greater Than or Equal" },
  { value: "lt", label: "Less Than" },
  { value: "lte", label: "Less Than or Equal" },
  { value: "contains", label: "Contains" },
  { value: "startswith", label: "Starts With" },
  { value: "endswith", label: "Ends With" },
  { value: "in", label: "In List" },
  { value: "is_null", label: "Is Null" },
  { value: "is_not_null", label: "Is Not Null" },
]

export function BrowseTab() {
  const { selectedDatasetId, datasets } = useDatasetStore()
  const dataset = datasets.find(d => d.id === selectedDatasetId)

  const [rows, setRows] = React.useState<RowData[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(100)
  const [filters, setFilters] = React.useState<ColumnFilter[]>([])
  const [sorts, setSorts] = React.useState<SortParams[]>([])
  const [showFilters, setShowFilters] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<RowData[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)

  const columns: ColumnDef<RowData>[] = React.useMemo(() => {
    if (!dataset) return []
    return dataset.schema.map((col) => ({
      accessorKey: col.name,
      header: () => (
        <div className="flex items-center gap-1">
          <span>{col.name}</span>
          <Badge variant="outline" className="text-xs">{col.type}</Badge>
          {col.nullable && <Badge variant="secondary" className="text-xs">nullable</Badge>}
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue()
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground">NULL</span>
        }
        if (typeof value === "object") {
          return <pre className="text-xs text-muted-foreground">{JSON.stringify(value)}</pre>
        }
        return <span>{String(value)}</span>
      },
    }))
  }, [dataset])

  const loadRows = React.useCallback(async () => {
    if (!dataset) return
    setLoading(true)
    try {
      const result = await api.getRows(dataset.id, page * pageSize, pageSize, filters, sorts)
      setRows(result.rows)
      setTotal(result.total)
    } catch (error) {
      toast.error("Failed to load rows")
    } finally {
      setLoading(false)
    }
  }, [dataset, page, pageSize, filters, sorts])

  React.useEffect(() => {
    loadRows()
  }, [loadRows])

  const handleSearch = async () => {
    if (!dataset || !searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const result = await api.search(dataset.id, searchQuery, { limit: 100 })
      setSearchResults(result.results.map(r => ({ id: r.row_id, data: r.data })))
      setPage(0)
    } catch (error) {
      toast.error("Search failed")
    } finally {
      setSearchLoading(false)
    }
  }

  const addFilter = () => {
    if (!dataset) return
    setFilters([...filters, { column: dataset.schema[0]?.name || "", operator: "eq", value: "" }])
  }

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index))
  }

  const updateFilter = (index: number, field: keyof ColumnFilter, value: any) => {
    setFilters(filters.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  if (!dataset) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a dataset from the sidebar to browse
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name}</h1>
          <p className="text-muted-foreground">
            {formatNumber(dataset.row_count)} rows · {dataset.column_count} columns · {dataset.format}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSearch} disabled={searchLoading}>
            <Search className="h-4 w-4 mr-2" />
            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            Filters ({filters.length})
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-md"
          />
        </div>
      </div>

      {showFilters && (
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2 flex-wrap">
                  <Select value={filter.column} onValueChange={(v) => updateFilter(index, "column", v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Column" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataset.schema.map((col) => (
                        <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filter.operator} onValueChange={(v) => updateFilter(index, "operator", v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={filter.value}
                    onChange={(e) => updateFilter(index, "value", e.target.value)}
                    placeholder="Value"
                    className="flex-1 min-w-[150px]"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeFilter(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addFilter}>
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex-1 min-h-0">
        {searchQuery && searchResults.length > 0 && (
          <div className="mb-2 text-sm text-muted-foreground">
            Showing {searchResults.length} search results
          </div>
        )}
        <DataTable
          columns={columns}
          data={searchQuery ? searchResults : rows}
          pageSize={pageSize}
          onRowClick={(row) => console.log("Row clicked:", row)}
        />
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm text-muted-foreground">
          Showing {rows.length} of {formatNumber(total)} rows
        </div>
        <div className="flex items-center gap-2">
          <Select value={pageSize} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 200, 500].map((size) => (
                <SelectItem key={size} value={String(size)}>{size} per page</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}