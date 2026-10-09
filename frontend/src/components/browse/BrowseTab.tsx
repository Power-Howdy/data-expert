import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/common/PageHeader"
import { formatNumber } from "@/lib/utils"
import { useBrowseTab } from "./useBrowseTab"
import { SearchStatus } from "./SearchStatus"
import { SearchBar } from "./SearchBar"
import { FilterPanel } from "./FilterPanel"
import { BrowseFooter } from "./BrowseFooter"
import { BrowseTable } from "./BrowseTable"
import { BrowseActions } from "./BrowseActions"
import { AIAssistant } from "./AIAssistant"
import { DataTools } from "./DataTools"
import { ViewBanner } from "./ViewBanner"
import { PendingChangesBar } from "./PendingChangesBar"
import { BrowseDialogs } from "./BrowseDialogs"
import { BrowseCopyNotice } from "./BrowseCopyNotice"

export function BrowseTab() {
  const { dataset, ai, tools, schema, columns, columnNames, data, search, browseCopy, panels, dialog, setDialog, showingSearch, editable } =
    useBrowseTab()

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
            isOpen={panels.isOpen} onToggle={panels.toggle} filterCount={data.filters.length} canSearch={!ai.view}
            onSave={() => setDialog("save")}
            onAddRow={ai.view ? undefined : () => setDialog("add")}
            onReplace={ai.view ? undefined : () => setDialog("replace")}
          />
        }
      />
      <div className="shrink-0 space-y-5 empty:hidden">
        <PendingChangesBar datasetId={dataset.id} />
        {!ai.view && <BrowseCopyNotice {...browseCopy} fileBytes={dataset.size_bytes} />}
        {panels.isOpen("ai") && <AIAssistant ai={ai} />}
        {panels.isOpen("tools") && <DataTools tools={tools} transform={ai} columns={columnNames} />}
        {panels.isOpen("search") && !ai.view && (
          <SearchBar query={search.query} loading={search.loading} onQueryChange={search.setQuery} onSearch={search.search} />
        )}
        {ai.view && <ViewBanner view={ai.view} onDiscard={ai.discardView} onApply={ai.applyView} applying={ai.applying} />}
        {panels.isOpen("filters") && <FilterPanel filters={data.filters} columns={columnNames} onChange={data.setFilters} />}
      </div>
      <Separator />
      {showingSearch && (
        <SearchStatus
          query={search.searched ?? ""} shown={search.results.length} total={search.total} totalExact={search.totalExact}
          tookMs={search.tookMs} indexing={search.indexing} onClear={search.clear}
        />
      )}
      <div className="min-h-[320px] flex-1">
        <BrowseTable
          columns={columns} rows={showingSearch ? search.results : data.rows} schema={schema}
          loading={showingSearch ? search.loading || search.indexing?.state === "building" : data.loading} rowOffset={showingSearch ? 0 : data.page * data.pageSize}
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
        filters={data.filters} rowCount={data.total} onSavedAs={() => { panels.close("ai"); panels.close("tools") }}
      />
    </div>
  )
}
