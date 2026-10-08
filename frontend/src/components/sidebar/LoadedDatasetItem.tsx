import { AlertCircle, Database } from "lucide-react"
import { CircularProgress } from "@/components/common/CircularProgress"
import { cn, formatNumber } from "@/lib/utils"
import type { Dataset, SearchIndexStatus } from "@/types"

interface LoadedDatasetItemProps {
  dataset: Dataset
  selected: boolean
  indexing?: SearchIndexStatus
  onSelect: () => void
}

/** A loaded dataset in the sidebar, with search-index progress while it builds. */
export function LoadedDatasetItem({ dataset, selected, indexing, onSelect }: LoadedDatasetItemProps) {
  const percent = indexing?.total ? (indexing.indexed / indexing.total) * 100 : 0

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition-all",
        selected ? "border-primary bg-primary/10 shadow-duo-primary" : "border-transparent bg-card hover:border-border"
      )}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-extrabold">{dataset.name}</span>
        </div>
        <div className="mt-0.5 pl-6 text-[11px] font-bold text-muted-foreground">
          {formatNumber(dataset.row_count)} rows · {dataset.format}
        </div>
      </div>
      {indexing?.state === "building" && (
        <CircularProgress
          value={percent} size={34}
          title={`Building search index: ${formatNumber(indexing.indexed)} of ${formatNumber(indexing.total)} rows`}
        />
      )}
      {indexing?.state === "error" && (
        <span title={`Search index failed: ${indexing.error ?? "unknown error"}`}>
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        </span>
      )}
    </button>
  )
}
