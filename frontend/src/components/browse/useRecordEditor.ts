import * as React from "react"
import toast from "react-hot-toast"
import { editApi } from "@/lib/editApi"
import { useEditStore } from "@/stores/useEditStore"
import type { ColumnSchema, RowData } from "@/types"
import { draftFromRecord, parseDraft, type FieldDraft, type RecordDraft } from "./fieldValue"

export type EditorMode = "fields" | "json"

interface Options {
  datasetId: string
  schema: ColumnSchema[]
  record: RowData | null
  onSaved: (row: RowData) => void
  onDeleted: () => void
}

export function useRecordEditor({ datasetId, schema, record, onSaved, onDeleted }: Options) {
  const initial = React.useMemo(() => draftFromRecord(record?.data ?? null, schema), [record, schema])
  const [draft, setDraft] = React.useState<RecordDraft>(initial)
  const [mode, setMode] = React.useState<EditorMode>("fields")
  const [jsonText, setJsonText] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const edited = useEditStore((s) => s.edited)

  React.useEffect(() => {
    setDraft(initial)
    setMode("fields")
    setErrors({})
  }, [initial])

  const setField = (name: string, value: FieldDraft) => {
    setDraft((d) => ({ ...d, [name]: value }))
    setErrors(({ [name]: _, ...rest }) => rest)
  }

  const parseJson = (): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(jsonText)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed
      setErrors({ _json: "The record must be a JSON object" })
    } catch (e) {
      setErrors({ _json: (e as Error).message })
    }
    return null
  }

  const currentValues = (): Record<string, unknown> | null => {
    if (mode === "json") return parseJson()
    const parsed = parseDraft(draft, schema)
    setErrors(parsed.errors)
    return Object.keys(parsed.errors).length ? null : parsed.values
  }

  const switchMode = (next: EditorMode) => {
    if (next === mode) return
    const values = currentValues()
    if (!values) return
    if (next === "json") setJsonText(JSON.stringify(values, null, 2))
    else setDraft(draftFromRecord(values, schema))
    setErrors({})
    setMode(next)
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      await edited(datasetId)
    } catch {
      // the API client shows the error
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const values = currentValues()
    if (!values) return
    return run(async () => {
      const row = record ? await editApi.updateRow(datasetId, record.id, values) : await editApi.addRow(datasetId, values)
      toast.success(record ? "Row updated (not yet saved to file)" : "Row added (not yet saved to file)")
      onSaved(row)
    })
  }

  const remove = () =>
    record &&
    run(async () => {
      await editApi.deleteRow(datasetId, record.id)
      toast.success("Row deleted (not yet saved to file)")
      onDeleted()
    })

  const changed = (name: string) => mode === "fields" && draft[name] !== initial[name]

  return { draft, setField, mode, switchMode, jsonText, setJsonText, errors, busy, save, remove, changed }
}

export type RecordEditorState = ReturnType<typeof useRecordEditor>
