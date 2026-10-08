import { SimpleSelect } from "@/components/common/SimpleSelect"
import { formatNumber } from "@/lib/utils"

const pageSizeOptions = [25, 50, 100, 200, 500].map((size) => ({
  value: String(size),
  label: `${size} per page`,
}))

interface BrowseFooterProps {
  shown: number
  total: number
  pageSize: number
  onPageSizeChange: (size: number) => void
}

export function BrowseFooter({ shown, total, pageSize, onPageSizeChange }: BrowseFooterProps) {
  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div className="text-sm text-muted-foreground">
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
