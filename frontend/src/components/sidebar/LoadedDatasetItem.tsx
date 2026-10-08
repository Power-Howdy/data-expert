import { AlertCircle, Database, Search, Zap } from "lucide-react"
import { CircularProgress } from "@/components/common/CircularProgress"
import { FeatureBadge } from "@/components/common/FeatureBadge"
import { cn, formatNumber } from "@/lib/utils"
import type { Dataset, DatasetFeatures, FeatureState, SearchIndexStatus } from "@/types"

interface LoadedDatasetItemProps {
  dataset: Dataset
  selected: boolean
  indexing?: SearchIndexStatus
  features?: DatasetFeatures
  onSelect: () => void
}

/** Search-index building and errors are shown by the progress ring and alert icon instead. */
const SEARCH_TITLES: Partial<Record<FeatureState, string>> = {
  ready: "Indexed for searching",
  missing: "Not indexed yet: the first search builds the index",
}
const BROWSE_TITLES: Partial<Record<FeatureState, string>> = {
  ready: "Optimized for browsing",
  building: "Optimizing for browsing…",
  missing: "Not optimized for browsing: deep pages load slowly",
  error: "Optimizing for browsing failed",
}

/** A loaded dataset in the sidebar, with search-index progress while it builds and icon badges for its search
 * index and browse copy. */
export function LoadedDatasetItem({ dataset, selected, indexing, features, onSelect }: LoadedDatasetItemProps) {
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
        <div className="mt-0.5 flex items-center gap-1 pl-6 text-[11px] font-bold text-muted-foreground">
          <span className="mr-auto truncate">{formatNumber(dataset.row_count)} rows · {dataset.format}</span>
          {features && <FeatureBadge icon={Search} state={features.search} titles={SEARCH_TITLES} />}
          {features && <FeatureBadge icon={Zap} state={features.browse} titles={BROWSE_TITLES} />}
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
