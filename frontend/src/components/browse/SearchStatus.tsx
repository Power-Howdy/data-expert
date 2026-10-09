import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/common/ProgressBar"
import { formatNumber } from "@/lib/utils"
import type { SearchIndexStatus } from "@/types"

interface SearchStatusProps {
  query: string
  shown: number
  total: number
  /** False when `total` is a lower bound (counting stopped early). */
  totalExact?: boolean
  /** How long the search took, in milliseconds. */
  tookMs?: number | null
  indexing: SearchIndexStatus | null
  onClear: () => void
}

/** What the table shows while searching: match count, or progress of the index a large file needs first. */
const formatTook = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`)

export function SearchStatus({ query, shown, total, totalExact = true, tookMs, indexing, onClear }: SearchStatusProps) {
  const count = `${formatNumber(total)}${totalExact ? "" : "+"}`
  const took = tookMs != null && <span className="font-semibold text-muted-foreground"> ({formatTook(tookMs)})</span>
  return (
    <div className="space-y-2 rounded-2xl border-2 border-secondary/40 bg-secondary/5 px-4 py-2">
      <div className="flex items-center gap-3 text-sm font-bold">
        {indexing?.state === "building" ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing search for this large file…
          </span>
        ) : indexing?.state === "error" ? (
          <span className="text-destructive">Could not prepare search: {indexing.error}</span>
        ) : total === 0 ? (
          <span>No rows match “{query}”{took}</span>
        ) : (
          <span>
            {total > shown ? `First ${formatNumber(shown)} of ${count}` : count} matches for “{query}”{took}
          </span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
          <X className="h-4 w-4" /> Clear search
        </Button>
      </div>
      {indexing?.state === "building" && (
        <>
          <ProgressBar value={indexing.indexed} max={indexing.total} label="Indexing rows" />
          <p className="text-xs font-semibold text-muted-foreground">
            This happens once per file version and the index is tiny (about 1/200 of the file). Results appear automatically when ready.
          </p>
        </>
      )}
    </div>
  )
}
