import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/common/ProgressBar"
import { formatNumber } from "@/lib/utils"
import type { SearchIndexStatus } from "@/types"

interface SearchStatusProps {
  query: string
  shown: number
  total: number
  indexing: SearchIndexStatus | null
  onClear: () => void
}

/** What the table shows while searching: match count, or progress of the index a large file needs first. */
export function SearchStatus({ query, shown, total, indexing, onClear }: SearchStatusProps) {
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
          <span>No rows match “{query}”</span>
        ) : (
          <span>
            {total > shown ? `First ${formatNumber(shown)} of ${formatNumber(total)}` : formatNumber(total)} matches for “{query}”
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
            This happens once per file version; later searches are instant. Results appear automatically when ready.
          </p>
        </>
      )}
    </div>
  )
}
