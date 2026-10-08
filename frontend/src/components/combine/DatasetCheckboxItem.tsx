import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn, formatNumber } from "@/lib/utils"
import { Dataset } from "@/types"

interface DatasetCheckboxItemProps {
  dataset: Dataset
  checked: boolean
  onToggle: () => void
}

export function DatasetCheckboxItem({ dataset, checked, onToggle }: DatasetCheckboxItemProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 p-3 transition-all",
        checked
          ? "border-primary bg-primary/10 shadow-duo-primary"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} />
        <div className="min-w-0">
          <p className="truncate font-extrabold">{dataset.name}</p>
          <p className="text-xs font-bold text-muted-foreground">
            {formatNumber(dataset.row_count)} rows · {dataset.schema.length} cols · {dataset.format}
          </p>
        </div>
      </div>
      <Badge variant="outline">{dataset.format}</Badge>
    </label>
  )
}
