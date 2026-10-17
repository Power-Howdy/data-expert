import * as React from "react"
import { Pencil, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidePanel } from "@/components/common/SidePanel"
import { RecordField } from "@/components/common/RecordField"
import { ConfirmButton } from "@/components/common/ConfirmButton"
import { LoadingButton } from "@/components/common/LoadingButton"
import { ColumnSchema, RowData } from "@/types"
import { RecordEditor } from "./RecordEditor"
import { textFirst } from "./columnOrder"
import { useRecordEditor } from "./useRecordEditor"

interface RecordDrawerProps {
  /** null opens an empty form for adding a row. */
  record: RowData | null
  schema: ColumnSchema[]
  title?: string
  onClose: () => void
  /** Enables editing; omitted for read-only data such as AI results. */
  datasetId?: string
}

export function RecordDrawer({ record, schema, title = "Record", onClose, datasetId }: RecordDrawerProps) {
  const [current, setCurrent] = React.useState(record)
  const [editing, setEditing] = React.useState(record === null)
  const editor = useRecordEditor({
    datasetId: datasetId ?? "",
    schema,
    record: current,
    onSaved: (row) => (current ? (setCurrent(row), setEditing(false)) : onClose()),
    onDeleted: onClose,
  })
  const fields = React.useMemo(() => textFirst(schema), [schema])
  const known = new Set(schema.map((c) => c.name))
  const extra = Object.keys(current?.data ?? {}).filter((key) => !known.has(key))

  const footer = !datasetId ? undefined : editing ? (
    <>
      <Button variant="ghost" onClick={() => (current ? setEditing(false) : onClose())} disabled={editor.busy}>
        Cancel
      </Button>
      <LoadingButton onClick={editor.save} loading={editor.busy} loadingText="Saving...">
        <Save className="h-4 w-4" /> {current ? "Save changes" : "Add row"}
      </LoadingButton>
    </>
  ) : (
    <>
      <ConfirmButton variant="ghost" onConfirm={editor.remove} disabled={editor.busy} className="mr-auto">
        <Trash2 className="h-4 w-4" /> Delete row
      </ConfirmButton>
      <Button onClick={() => setEditing(true)}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
    </>
  )

  return (
    <SidePanel
      title={current ? title : "New row"}
      subtitle={editing ? "Changes stay pending until you save them to the file" : `${schema.length + extra.length} fields`}
      onClose={onClose}
      footer={footer}
    >
      {editing ? (
        <RecordEditor editor={editor} schema={fields} />
      ) : (
        <div className="space-y-3">
          {fields.map((col) => (
            <RecordField key={col.name} name={col.name} type={col.type} value={current?.data?.[col.name]} />
          ))}
          {extra.map((key) => (
            <RecordField key={key} name={key} value={current?.data[key]} />
          ))}
        </div>
      )}
    </SidePanel>
  )
}
