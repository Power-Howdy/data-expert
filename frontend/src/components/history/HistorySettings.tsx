import * as React from "react"
import { Trash2 } from "lucide-react"
import { ConfirmButton } from "@/components/common/ConfirmButton"
import { LoadingButton } from "@/components/common/LoadingButton"
import { NumberField } from "@/components/common/NumberField"
import { SidePanel } from "@/components/common/SidePanel"
import { formatBytes } from "@/lib/utils"
import type { VersionHistory } from "@/types/version"

interface HistorySettingsProps {
  history: VersionHistory
  saving?: boolean
  onSave: (keepSnapshots: number) => void
  onDelete: () => void
  onClose: () => void
}

/** Storage used by the history, how many full snapshots to keep, and deleting the history. */
export function HistorySettings({ history, saving, onSave, onDelete, onClose }: HistorySettingsProps) {
  const [keep, setKeep] = React.useState(history.keep_snapshots)
  const footer = (
    <LoadingButton onClick={() => onSave(keep)} loading={!!saving} loadingText="Saving..." disabled={keep === history.keep_snapshots}>
      Save
    </LoadingButton>
  )

  return (
    <SidePanel title="History settings" subtitle={`${formatBytes(history.storage_bytes)} used`} onClose={onClose} footer={footer}>
      <section className="space-y-2 text-sm font-semibold text-muted-foreground">
        <p>
          Row edits are stored as small reverse deltas. Transforms (sorting, reshaping, AI changes) keep a full snapshot of the
          previous file instead; on the same drive this is a hard link, so it only takes space once the file is replaced again.
        </p>
        <p className="break-all text-xs">
          Stored in <code className="font-mono">{history.storage_path}</code>
        </p>
      </section>
      <NumberField
        label="Snapshots to keep" value={keep} onChange={setKeep} min={0} max={100}
        hint="Older snapshots are removed; versions that need them can no longer be viewed or restored."
      />
      <section className="space-y-2 rounded-2xl border-2 border-destructive/40 p-4">
        <h4 className="text-sm font-extrabold text-destructive">Delete history</h4>
        <p className="text-xs font-semibold text-muted-foreground">
          Removes every saved version of this file. The current file is kept as it is.
        </p>
        <ConfirmButton variant="outline" size="sm" onConfirm={onDelete} confirmLabel="Delete all versions?">
          <Trash2 className="h-4 w-4" /> Delete history
        </ConfirmButton>
      </section>
    </SidePanel>
  )
}
