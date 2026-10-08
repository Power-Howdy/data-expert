import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Dataset, DatasetFeatures, SearchIndexStatus } from "@/types"
import { LoadedDatasetItem } from "./LoadedDatasetItem"

interface LoadedDatasetsListProps {
  datasets: Dataset[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Search-index progress by dataset id. */
  indexing?: Record<string, SearchIndexStatus>
  /** Search index and browse copy state by dataset id. */
  features?: Record<string, DatasetFeatures>
  /** Fill the remaining height instead of a short fixed list. */
  grow?: boolean
}

export function LoadedDatasetsList({ datasets, selectedId, onSelect, indexing = {}, features = {}, grow }: LoadedDatasetsListProps) {
  return (
    <div className={cn("flex flex-col bg-muted/30 p-3", grow ? "min-h-0 flex-1" : "border-t-2 border-border")}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
          Loaded
        </span>
        <Badge variant="sky">{datasets.length}</Badge>
      </div>
      <ScrollArea className={grow ? "min-h-0 flex-1" : "max-h-44"}>
        {datasets.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs font-semibold text-muted-foreground">
            Click a file in the tree to load it
          </p>
        ) : (
          <ul className="space-y-1.5 pb-1 pr-2">
            {datasets.map((dataset) => (
              <li key={dataset.id}>
                <LoadedDatasetItem
                  dataset={dataset} selected={selectedId === dataset.id} indexing={indexing[dataset.id]}
                  features={features[dataset.id]}
                  onSelect={() => onSelect(dataset.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
