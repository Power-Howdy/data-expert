import { Database } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Dataset } from "@/types"

interface LoadedDatasetsListProps {
  datasets: Dataset[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function LoadedDatasetsList({ datasets, selectedId, onSelect }: LoadedDatasetsListProps) {
  return (
    <div className="p-4">
      <div className="mb-2 text-xs font-medium text-muted-foreground uppercase">
        Loaded Datasets ({datasets.length})
      </div>
      <ScrollArea className="max-h-40">
        {datasets.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">No datasets loaded</div>
        ) : (
          <ul className="space-y-1">
            {datasets.map((dataset) => (
              <li key={dataset.id}>
                <button
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-sm transition-colors hover:bg-accent",
                    selectedId === dataset.id && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => onSelect(dataset.id)}
                >
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="truncate">{dataset.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {dataset.row_count.toLocaleString()} rows · {dataset.format}
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
