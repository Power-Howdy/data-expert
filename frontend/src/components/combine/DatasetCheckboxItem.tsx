import { Badge } from "@/components/ui/badge"
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
        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <div>
          <p className="font-medium">{dataset.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatNumber(dataset.row_count)} rows · {dataset.schema.length} cols · {dataset.format}
          </p>
        </div>
      </div>
      <Badge variant="outline">{dataset.format}</Badge>
    </label>
  )
}
