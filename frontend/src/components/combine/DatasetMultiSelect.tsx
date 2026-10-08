import { Plus } from "lucide-react"
import { SectionCard } from "@/components/common/SectionCard"
import { Dataset } from "@/types"
import { DatasetCheckboxItem } from "./DatasetCheckboxItem"

interface DatasetMultiSelectProps {
  datasets: Dataset[]
  selectedIds: string[]
  onToggle: (id: string) => void
}

export function DatasetMultiSelect({ datasets, selectedIds, onToggle }: DatasetMultiSelectProps) {
  return (
    <SectionCard
      title={`Select Datasets to Combine (${selectedIds.length} selected)`}
      icon={<Plus className="h-5 w-5" />}
    >
      {datasets.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No datasets loaded</p>
      ) : (
        <div className="grid gap-2 max-h-60 overflow-auto">
          {datasets.map((dataset) => (
            <DatasetCheckboxItem
              key={dataset.id}
              dataset={dataset}
              checked={selectedIds.includes(dataset.id)}
              onToggle={() => onToggle(dataset.id)}
            />
          ))}
        </div>
      )}
    </SectionCard>
  )
}
