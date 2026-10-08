import { SimpleSelect } from "@/components/common/SimpleSelect"
import { formatNumber } from "@/lib/utils"

const pageSizeOptions = [25, 50, 100, 200, 500].map((size) => ({
  value: String(size),
  label: `${size} / page`,
}))

interface BrowseFooterProps {
  shown: number
  total: number
  pageSize: number
  onPageSizeChange: (size: number) => void
}

export function BrowseFooter({ shown, total, pageSize, onPageSizeChange }: BrowseFooterProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3">
      <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Showing {shown} of {formatNumber(total)} rows
      </div>
      <SimpleSelect
        value={String(pageSize)}
        onChange={(v) => onPageSizeChange(Number(v))}
        options={pageSizeOptions}
        className="w-36"
      />
    </div>
  )
}
