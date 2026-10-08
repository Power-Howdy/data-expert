import { TextPromptDialog } from "@/components/common/TextPromptDialog"
import type { Dataset } from "@/types"
import type { VersionInfo } from "@/types/version"
import type { VersionHistoryState } from "./useVersionHistory"
import { DiffPanel } from "./DiffPanel"
import { HistorySettings } from "./HistorySettings"
import { SaveVersionDialog } from "./SaveVersionDialog"
import { VersionPreview } from "./VersionPreview"
import { TAG_PATTERN, shortId } from "./versionLabels"

export type HistoryDialog =
  | { type: "preview" | "tag" | "save"; commit: VersionInfo }
  | { type: "diff"; a: string; b: string }
  | { type: "settings" }
  | null

interface HistoryDialogsProps {
  dialog: HistoryDialog
  dataset: Dataset
  versions: VersionHistoryState
  onClose: () => void
}

export function HistoryDialogs({ dialog, dataset, versions, onClose }: HistoryDialogsProps) {
  if (!dialog) return null
  if (dialog.type === "preview") return <VersionPreview datasetId={dataset.id} commit={dialog.commit} onClose={onClose} />
  if (dialog.type === "save") return <SaveVersionDialog dataset={dataset} commit={dialog.commit} onClose={onClose} />
  if (dialog.type === "diff") return <DiffPanel datasetId={dataset.id} a={dialog.a} b={dialog.b} onClose={onClose} />
  if (dialog.type === "tag") {
    return (
      <TextPromptDialog
        title={`Tag version ${shortId(dialog.commit.id)}`} label="Tag name" placeholder="e.g. v1 or cleaned" submitLabel="Add tag"
        description="A tag is a name for a version, e.g. the one used to train a model. Moving a tag to another version is allowed."
        validate={(v) => (TAG_PATTERN.test(v) ? undefined : "Use letters, digits, '.', '_' or '-' (up to 40 characters)")}
        onSubmit={(name) => versions.tag(name, dialog.commit.id)} onClose={onClose}
      />
    )
  }
  if (!versions.history) return null
  return (
    <HistorySettings
      history={versions.history} saving={versions.busy === "settings"}
      onSave={async (keep) => (await versions.configure(keep), onClose())}
      onDelete={async () => (await versions.destroy(), onClose())} onClose={onClose}
    />
  )
}
