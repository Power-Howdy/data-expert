import * as React from "react"
import axios from "axios"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import { LoadingButton } from "@/components/common/LoadingButton"
import { Modal } from "@/components/common/Modal"
import { SimpleSelect } from "@/components/common/SimpleSelect"
import { versionApi } from "@/lib/versionApi"
import { useDatasetStore } from "@/stores/useStore"
import type { Dataset } from "@/types"
import type { VersionFormat, VersionInfo } from "@/types/version"
import { shortId } from "./versionLabels"

const FORMATS = [
  { value: "parquet", label: "Parquet (recommended)" },
  { value: "jsonl", label: "JSON Lines" },
  { value: "json", label: "JSON" },
  { value: "csv", label: "CSV (flat columns only)" },
]

interface SaveVersionDialogProps {
  dataset: Dataset
  commit: VersionInfo
  onClose: () => void
}

/** Write one version to a new file next to the dataset and open it. */
export function SaveVersionDialog({ dataset, commit, onClose }: SaveVersionDialogProps) {
  const { addDataset } = useDatasetStore()
  const [name, setName] = React.useState(`${dataset.name}_${commit.tags[0] ?? shortId(commit.id)}`)
  const [format, setFormat] = React.useState<VersionFormat>("parquet")
  const [saving, setSaving] = React.useState(false)
  const [conflict, setConflict] = React.useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const saved = await versionApi.saveAs(dataset.id, commit.id, { name, format, overwrite: conflict })
      addDataset(saved)
      toast.success(`Saved version ${shortId(commit.id)} as ${saved.name}`)
      onClose()
    } catch (error) {
      const response = axios.isAxiosError(error) ? error.response : undefined
      if (response?.status === 409) setConflict(true)
      else toast.error((response?.data as { detail?: string })?.detail || "Could not save this version")
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <LoadingButton onClick={save} loading={saving} loadingText="Saving..." variant={conflict ? "destructive" : "default"} disabled={!name.trim()}>
        {conflict ? "Overwrite" : "Save"}
      </LoadingButton>
    </>
  )

  return (
    <Modal title={`Save version ${shortId(commit.id)} as…`} onClose={onClose} footer={footer}>
      <FormField label="Name">
        <Input value={name} onChange={(e) => (setName(e.target.value), setConflict(false))} autoFocus />
      </FormField>
      <FormField label="Format">
        <SimpleSelect value={format} onChange={(v) => (setFormat(v as VersionFormat), setConflict(false))} options={FORMATS} />
      </FormField>
      {conflict && <p className="text-xs font-bold text-destructive">A file with this name already exists. Rename, or click Overwrite.</p>}
    </Modal>
  )
}
