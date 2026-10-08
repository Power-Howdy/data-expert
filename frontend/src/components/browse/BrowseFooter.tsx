import { Loader2 } from "lucide-react"
import { Pager } from "@/components/common/Pager"
import { SimpleSelect } from "@/components/common/SimpleSelect"
import { formatNumber } from "@/lib/utils"

const pageSizeOptions = [25, 50, 100, 200, 500].map((size) => ({
  value: String(size),
  label: `${size} / page`,
}))

interface BrowseFooterProps {
  page: number
  pageCount: number
  pageSize: number
  shown: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function BrowseFooter({
  page, pageCount, pageSize, shown, total, loading, onPageChange, onPageSizeChange,
}: BrowseFooterProps) {
  const start = shown > 0 ? page * pageSize + 1 : 0
  const end = page * pageSize + shown

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        {loading && shown === 0
          ? "Loading rows..."
          : `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)} rows`}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Pager page={page} pageCount={pageCount} onPageChange={onPageChange} disabled={loading} />
        <SimpleSelect
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={pageSizeOptions}
          className="w-36"
        />
      </div>
    </div>
  )
}
