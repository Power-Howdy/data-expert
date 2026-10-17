import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChoiceChip } from "@/components/common/ChoiceChip"
import { CheckboxField } from "@/components/common/CheckboxField"
import { FormField } from "@/components/common/FormField"
import { LoadingButton } from "@/components/common/LoadingButton"
import { Modal } from "@/components/common/Modal"
import { SimpleSelect, toOptions } from "@/components/common/SimpleSelect"
import type { ReplaceMode } from "@/lib/editApi"
import { useReplace } from "./useReplace"

const MODES: Array<{ value: ReplaceMode; label: string; hint: string }> = [
  { value: "contains", label: "Contains", hint: "Replaces the text wherever it appears" },
  { value: "exact", label: "Whole value", hint: "Replaces cells equal to the value (any column type)" },
  { value: "regex", label: "Regex", hint: "Regular expression; use $1, $2 for groups" },
]

interface ReplaceDialogProps {
  datasetId: string
  columns: string[]
  onClose: () => void
}

export function ReplaceDialog({ datasetId, columns, onClose }: ReplaceDialogProps) {
  const r = useReplace(datasetId, columns, onClose)
  const current = MODES.find((m) => m.value === r.mode)!

  const footer = (
    <>
      <span className="mr-auto text-xs font-bold text-muted-foreground">
        {r.previewError ? (
          <span className="text-destructive">{r.previewError}</span>
        ) : r.count !== null ? (
          `${r.count.toLocaleString()} matching rows`
        ) : r.find ? "Counting..." : ""}
      </span>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <LoadingButton onClick={r.replace} loading={r.replacing} loadingText="Replacing..." disabled={!r.find || r.count === 0 || !!r.previewError}>
        Replace all
      </LoadingButton>
    </>
  )

  return (
    <Modal title="Find & replace" onClose={onClose} footer={footer}>
      <FormField label="Column">
        <SimpleSelect value={r.column} onChange={r.setColumn} options={toOptions(columns)} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <ChoiceChip key={m.value} active={r.mode === m.value} onClick={() => r.setMode(m.value)}>{m.label}</ChoiceChip>
        ))}
      </div>
      <p className="-mt-2 text-xs font-semibold text-muted-foreground">{current.hint}</p>
      <FormField label="Find">
        <Input value={r.find} onChange={(e) => r.setFind(e.target.value)} autoFocus className={r.mode === "regex" ? "font-mono" : ""} />
      </FormField>
      <FormField label="Replace with">
        <Input value={r.replaceWith} onChange={(e) => r.setReplaceWith(e.target.value)} disabled={r.mode === "exact" && r.setNull} />
      </FormField>
      {r.mode === "exact" && <CheckboxField label="Set matching cells to NULL" checked={r.setNull} onChange={r.setSetNull} />}
      <CheckboxField label="Case sensitive" checked={r.caseSensitive} onChange={r.setCaseSensitive} />
    </Modal>
  )
}
