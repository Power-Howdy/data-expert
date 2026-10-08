import { SidePanel } from "@/components/common/SidePanel"
import { RecordField } from "@/components/common/RecordField"
import { ColumnSchema, RowData } from "@/types"

interface RecordDrawerProps {
  record: RowData
  schema: ColumnSchema[]
  title?: string
  onClose: () => void
}

export function RecordDrawer({ record, schema, title = "Record", onClose }: RecordDrawerProps) {
  const known = new Set(schema.map((c) => c.name))
  const extra = Object.keys(record.data ?? {}).filter((key) => !known.has(key))

  return (
    <SidePanel title={title} subtitle={`${schema.length + extra.length} fields`} onClose={onClose}>
      <div className="space-y-3">
        {schema.map((col) => (
          <RecordField key={col.name} name={col.name} type={col.type} value={record.data?.[col.name]} />
        ))}
        {extra.map((key) => (
          <RecordField key={key} name={key} value={record.data[key]} />
        ))}
      </div>
    </SidePanel>
  )
}
