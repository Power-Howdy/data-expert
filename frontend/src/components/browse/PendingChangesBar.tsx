import * as React from "react"
import { ChevronDown, ChevronUp, PenLine, Save, Trash2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmButton } from "@/components/common/ConfirmButton"
import { LoadingButton } from "@/components/common/LoadingButton"
import { TextPromptDialog } from "@/components/common/TextPromptDialog"
import { useDatasetChanges } from "./useDatasetChanges"

interface PendingChangesBarProps {
  datasetId: string
}

const COUNTS = [
  ["added", "added"], ["updated", "updated"], ["deleted", "deleted"],
  ["replaced", "replacements"], ["transformed", "transforms"],
] as const

export function PendingChangesBar({ datasetId }: PendingChangesBarProps) {
  const changes = useDatasetChanges(datasetId)
  const [expanded, setExpanded] = React.useState(false)
  const [committing, setCommitting] = React.useState(false)
  const summary = changes.summary
  if (!summary?.total) return null
  const parts = COUNTS.filter(([key]) => summary[key] > 0).map(([key, label]) => `${summary[key]} ${label}`)

  return (
    <div className="space-y-2 rounded-2xl border-2 border-primary/50 bg-primary/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <PenLine className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-bold">
          {summary.total} unsaved {summary.total === 1 ? "change" : "changes"}
          <span className="ml-2 font-semibold text-muted-foreground">{parts.join(" · ")}</span>
        </span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} Details
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={changes.undo} disabled={!!changes.busy}>
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
          <ConfirmButton variant="ghost" size="sm" onConfirm={changes.discard} disabled={!!changes.busy} confirmLabel="Discard all?">
            <Trash2 className="h-4 w-4" /> Discard
          </ConfirmButton>
          <LoadingButton size="sm" onClick={() => setCommitting(true)} loading={changes.busy === "commit"} loadingText="Saving..." disabled={!!changes.busy}>
            <Save className="h-4 w-4" /> Save to file
          </LoadingButton>
        </div>
      </div>
      {committing && (
        <TextPromptDialog
          title="Save as a new version" label="Version message (optional)" optional submitLabel="Save to file"
          placeholder={summary.items.length === 1 ? summary.items[0].label : `${summary.total} changes`}
          description="The file is updated and the previous version stays available in the History tab."
          onSubmit={changes.commit} onClose={() => setCommitting(false)}
        />
      )}
      {expanded && (
        <ol className="max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-8 text-xs font-semibold text-muted-foreground">
          {summary.items.map((item, i) => (
            <li key={i}>{item.label}</li>
          ))}
        </ol>
      )}
      <p className="text-xs font-semibold text-muted-foreground">
        Edits are shown everywhere but the file on disk is unchanged until you click “Save to file”.
      </p>
    </div>
  )
}
