import * as React from "react"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/common/PageHeader"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { formatNumber } from "@/lib/utils"
import { useBrowseData } from "./useBrowseData"
import { useDatasetColumns } from "./useDatasetColumns"
import { useAITransform } from "./useAITransform"
import { FilterPanel } from "./FilterPanel"
import { BrowseFooter } from "./BrowseFooter"
import { BrowseTable } from "./BrowseTable"
import { BrowseActions } from "./BrowseActions"
import { AIAssistant } from "./AIAssistant"
import { ViewBanner } from "./ViewBanner"
import { PendingChangesBar } from "./PendingChangesBar"
import { BrowseDialogs, type BrowseDialog } from "./BrowseDialogs"

export function BrowseTab() {
  const dataset = useSelectedDataset()
  const ai = useAITransform(dataset?.id)
  const schema = ai.view?.schema ?? dataset?.schema
  const columns = useDatasetColumns(schema)
  const data = useBrowseData(dataset, ai.view)
  const [showFilters, setShowFilters] = React.useState(false)
  const [showAI, setShowAI] = React.useState(false)
  const [dialog, setDialog] = React.useState<BrowseDialog>(null)
  const showingSearch = !ai.view && data.searchResults.length > 0
  const editable = !ai.view && !showingSearch

  if (!dataset || !schema) {
    return (
      <EmptyState title="No dataset selected">
        Choose a folder in the sidebar, then click a file to browse its rows
      </EmptyState>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        title={dataset.name}
        subtitle={`${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns · ${dataset.format}`}
        actions={
          <BrowseActions
            onSearch={ai.view ? undefined : data.search} searchLoading={data.searchLoading}
            filterCount={data.filters.length} onToggleFilters={() => setShowFilters(!showFilters)}
            aiOpen={showAI} onToggleAI={() => setShowAI(!showAI)}
            onSave={() => setDialog("save")}
            onAddRow={ai.view ? undefined : () => setDialog("add")}
            onReplace={ai.view ? undefined : () => setDialog("replace")}
          />
        }
      />
      {!ai.view && (
        <Input
          placeholder="Search across rows..." value={data.searchQuery} className="max-w-md"
          onChange={(e) => data.setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && data.search()}
        />
      )}
      <div className="shrink-0 space-y-5 empty:hidden">
        <PendingChangesBar datasetId={dataset.id} />
        {showAI && <AIAssistant ai={ai} />}
        {ai.view && <ViewBanner view={ai.view} onDiscard={ai.discardView} onApply={ai.applyView} applying={ai.applying} />}
        {showFilters && <FilterPanel filters={data.filters} columns={schema.map((c) => c.name)} onChange={data.setFilters} />}
      </div>
      <Separator />
      {showingSearch && (
        <div className="-mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Showing {data.searchResults.length} search results
        </div>
      )}
      <div className="min-h-[320px] flex-1">
        <BrowseTable
          columns={columns} rows={showingSearch ? data.searchResults : data.rows} schema={schema}
          loading={data.loading} rowOffset={showingSearch ? 0 : data.page * data.pageSize}
          datasetId={editable ? dataset.id : undefined}
        />
      </div>
      {!showingSearch && (
        <BrowseFooter
          page={data.page} pageCount={data.pageCount} pageSize={data.pageSize}
          shown={data.rows.length} total={data.total} loading={data.loading}
          onPageChange={data.setPage} onPageSizeChange={data.changePageSize}
        />
      )}
      <BrowseDialogs
        dialog={dialog} onClose={() => setDialog(null)} dataset={dataset} schema={schema} view={ai.view}
        filters={data.filters} rowCount={data.total} onSavedAs={() => setShowAI(false)}
      />
    </div>
  )
}
