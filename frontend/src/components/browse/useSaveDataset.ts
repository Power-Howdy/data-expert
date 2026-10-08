import * as React from "react"
import toast from "react-hot-toast"
import axios from "axios"
import { aiApi } from "@/lib/aiApi"
import { useDatasetStore } from "@/stores/useStore"
import type { Dataset } from "@/types"
import type { DataView, SaveFormat } from "@/types/ai"
import type { ColumnFilter } from "./filterOperators"

interface SaveSource {
  dataset: Dataset
  view: DataView | null
  filters: ColumnFilter[]
  onSaved?: (saved: Dataset) => void
}

export function useSaveDataset({ dataset, view, filters, onSaved }: SaveSource) {
  const { addDataset, selectDataset } = useDatasetStore()
  const [name, setName] = React.useState(`${dataset.name}_${view ? "ai" : "subset"}`)
  const [format, setFormat] = React.useState<SaveFormat>("parquet")
  const [saving, setSaving] = React.useState(false)
  const [conflict, setConflict] = React.useState(false)

  const save = async (overwrite = false) => {
    setSaving(true)
    try {
      const saved = await aiApi.saveAs(dataset.id, { name, format, view_id: view?.id, filters, overwrite })
      addDataset(saved)
      selectDataset(saved.id)
      toast.success(`Saved ${saved.row_count.toLocaleString()} rows as ${saved.name}`)
      onSaved?.(saved)
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const detail = axios.isAxiosError(error) ? (error.response?.data as { detail?: string })?.detail : undefined
      if (status === 409) setConflict(true)
      else toast.error(detail || "Could not save dataset")
    } finally {
      setSaving(false)
    }
  }

  const changeName = (value: string) => {
    setName(value)
    setConflict(false)
  }

  const changeFormat = (value: SaveFormat) => {
    setFormat(value)
    setConflict(false)
  }

  return { name, setName: changeName, format, setFormat: changeFormat, saving, conflict, save }
}
