import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils"

interface PagerProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function Pager({ page, pageCount, onPageChange, disabled }: PagerProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 0}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[110px] text-center text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Page {formatNumber(page + 1)} of {formatNumber(pageCount)}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= pageCount - 1}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
