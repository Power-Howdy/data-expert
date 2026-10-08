import type { ColumnSchema, Dataset } from "@/types"
import type { DataView } from "@/types/ai"
import type { ColumnFilter } from "./filterOperators"
import { RecordDrawer } from "./RecordDrawer"
import { ReplaceDialog } from "./ReplaceDialog"
import { SaveDatasetDialog } from "./SaveDatasetDialog"

export type BrowseDialog = "save" | "replace" | "add" | null

interface BrowseDialogsProps {
  dialog: BrowseDialog
  onClose: () => void
  dataset: Dataset
  schema: ColumnSchema[]
  view: DataView | null
  filters: ColumnFilter[]
  rowCount: number
  onSavedAs?: () => void
}

export function BrowseDialogs({ dialog, onClose, dataset, schema, view, filters, rowCount, onSavedAs }: BrowseDialogsProps) {
  if (dialog === "save") {
    return (
      <SaveDatasetDialog
        dataset={dataset} view={view} filters={filters} rowCount={rowCount}
        onClose={onClose} onSaved={onSavedAs}
      />
    )
  }
  if (dialog === "replace") {
    return <ReplaceDialog datasetId={dataset.id} columns={schema.map((c) => c.name)} onClose={onClose} />
  }
  if (dialog === "add") {
    return <RecordDrawer record={null} schema={schema} datasetId={dataset.id} onClose={onClose} />
  }
  return null
}
