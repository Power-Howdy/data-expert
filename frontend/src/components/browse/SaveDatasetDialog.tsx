import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import { LoadingButton } from "@/components/common/LoadingButton"
import { Modal } from "@/components/common/Modal"
import { SimpleSelect } from "@/components/common/SimpleSelect"
import type { Dataset } from "@/types"
import type { DataView, SaveFormat } from "@/types/ai"
import type { ColumnFilter } from "./filterOperators"
import { useSaveDataset } from "./useSaveDataset"

const FORMATS = [
  { value: "parquet", label: "Parquet (recommended, keeps nested columns)" },
  { value: "jsonl", label: "JSON Lines" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV (flat columns only)" },
]

interface SaveDatasetDialogProps {
  dataset: Dataset
  view: DataView | null
  filters: ColumnFilter[]
  rowCount: number
  onClose: () => void
  onSaved?: (saved: Dataset) => void
}

export function SaveDatasetDialog({ dataset, view, filters, rowCount, onClose, onSaved }: SaveDatasetDialogProps) {
  const s = useSaveDataset({ dataset, view, filters, onSaved: (saved) => { onSaved?.(saved); onClose() } })
  const source = view ? "the AI result" : filters.length ? "the filtered rows" : "all rows"

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <LoadingButton
        onClick={() => s.save(s.conflict)}
        loading={s.saving}
        loadingText="Saving..."
        variant={s.conflict ? "destructive" : "default"}
        disabled={!s.name.trim()}
      >
        {s.conflict ? "Overwrite" : "Save"}
      </LoadingButton>
    </>
  )

  return (
    <Modal title="Save as new dataset" onClose={onClose} footer={footer}>
      <p className="text-sm font-semibold text-muted-foreground">
        Saves {source} ({rowCount.toLocaleString()} rows) next to <span className="font-bold text-foreground">{dataset.name}</span> and
        opens it.
      </p>
      <FormField label="Name">
        <Input value={s.name} onChange={(e) => s.setName(e.target.value)} autoFocus />
      </FormField>
      <FormField label="Format">
        <SimpleSelect value={s.format} onChange={(v) => s.setFormat(v as SaveFormat)} options={FORMATS} />
      </FormField>
      {s.conflict && (
        <p className="text-xs font-bold text-destructive">A file with this name already exists. Rename, or click Overwrite.</p>
      )}
    </Modal>
  )
}
