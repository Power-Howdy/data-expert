import { Database } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn, formatNumber } from "@/lib/utils"
import { Dataset } from "@/types"

interface LoadedDatasetsListProps {
  datasets: Dataset[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function LoadedDatasetsList({ datasets, selectedId, onSelect }: LoadedDatasetsListProps) {
  return (
    <div className="border-t-2 border-border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Loaded
        </span>
        <Badge variant="sky">{datasets.length}</Badge>
      </div>
      <ScrollArea className="max-h-44">
        {datasets.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs font-semibold text-muted-foreground">
            Click a file in the tree to load it
          </p>
        ) : (
          <ul className="space-y-1.5">
            {datasets.map((dataset) => (
              <li key={dataset.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-xl border-2 px-2.5 py-2 text-left transition-all",
                    selectedId === dataset.id
                      ? "border-primary bg-primary/10 shadow-duo-primary"
                      : "border-transparent bg-card hover:border-border"
                  )}
                  onClick={() => onSelect(dataset.id)}
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-sm font-extrabold">{dataset.name}</span>
                  </div>
                  <div className="mt-0.5 pl-6 text-[11px] font-bold text-muted-foreground">
                    {formatNumber(dataset.row_count)} rows · {dataset.format}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
