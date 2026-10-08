import * as React from "react"
import { Filter, Loader2, Search } from "lucide-react"
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
import { BrowseTable } from "./BrowseTable"

export function BrowseTab() {
  const dataset = useSelectedDataset()
  const columns = useDatasetColumns(dataset)
  const data = useBrowseData(dataset)
  const [showFilters, setShowFilters] = React.useState(false)
  const showingSearch = data.searchResults.length > 0

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
      {showingSearch && (
        <div className="-mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Showing {data.searchResults.length} search results
        </div>
      )}
      <div className="min-h-0 flex-1">
        <BrowseTable
          columns={columns}
          rows={showingSearch ? data.searchResults : data.rows}
          schema={dataset.schema}
          loading={data.loading}
          rowOffset={showingSearch ? 0 : data.page * data.pageSize}
        />
      </div>
      {!showingSearch && (
        <BrowseFooter
          page={data.page}
          pageCount={data.pageCount}
          pageSize={data.pageSize}
          shown={data.rows.length}
          total={data.total}
          loading={data.loading}
          onPageChange={data.setPage}
          onPageSizeChange={data.changePageSize}
        />
      )}
    </div>
  )
}
