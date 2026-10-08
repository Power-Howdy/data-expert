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

  if (!dataset) {
    return (
      <EmptyState title="No dataset selected">
        Choose a folder in the sidebar, then click a file to browse its rows
      </EmptyState>
    )
  }

  const actions = (
    <>
      <Button variant="sky" size="sm" onClick={data.search} disabled={data.searchLoading}>
        {data.searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Search
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
        <Filter className="h-4 w-4" />
        Filters ({data.filters.length})
      </Button>
    </>
  )

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        title={dataset.name}
        subtitle={`${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns · ${dataset.format}`}
        actions={actions}
      />
      <Input
        placeholder="Search across rows..."
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
      <div className="min-h-0 flex-1">
        {data.searchQuery && data.searchResults.length > 0 && (
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
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
