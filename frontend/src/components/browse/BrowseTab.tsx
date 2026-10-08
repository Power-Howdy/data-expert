import * as React from "react"
import { Filter, Loader2, Search } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/common/PageHeader"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { formatNumber } from "@/lib/utils"
import { useBrowseData } from "./useBrowseData"
import { useDatasetColumns } from "./useDatasetColumns"
import { FilterPanel } from "./FilterPanel"
import { BrowseFooter } from "./BrowseFooter"

export function BrowseTab() {
  const dataset = useSelectedDataset()
  const columns = useDatasetColumns(dataset)
  const data = useBrowseData(dataset)
  const [showFilters, setShowFilters] = React.useState(false)

  if (!dataset) return <EmptyState>Select a dataset from the sidebar to browse</EmptyState>

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={data.search} disabled={data.searchLoading}>
        <Search className="h-4 w-4 mr-2" />
        {data.searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
        <Filter className="h-4 w-4 mr-2" />
        Filters ({data.filters.length})
      </Button>
    </>
  )

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <PageHeader
        title={dataset.name}
        subtitle={`${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns · ${dataset.format}`}
        actions={actions}
      />
      <Input
        placeholder="Search..."
        value={data.searchQuery}
        onChange={(e) => data.setSearchQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && data.search()}
        className="max-w-md"
      />
      {showFilters && (
        <FilterPanel
          filters={data.filters}
          columns={dataset.schema.map((c) => c.name)}
          onChange={data.setFilters}
        />
      )}
      <Separator />
      <div className="flex-1 min-h-0">
        {data.searchQuery && data.searchResults.length > 0 && (
          <div className="mb-2 text-sm text-muted-foreground">
            Showing {data.searchResults.length} search results
          </div>
        )}
        <DataTable
          columns={columns}
          data={data.searchQuery ? data.searchResults : data.rows}
          pageSize={data.pageSize}
        />
      </div>
      <BrowseFooter
        shown={data.rows.length}
        total={data.total}
        pageSize={data.pageSize}
        onPageSizeChange={data.changePageSize}
      />
    </div>
  )
}
