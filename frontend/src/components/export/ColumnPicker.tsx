import { FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SectionCard } from "@/components/common/SectionCard"
import { ColumnSchema } from "@/types"

interface ColumnPickerProps {
  schema: ColumnSchema[]
  selected: string[]
  onChange: (columns: string[]) => void
}

export function ColumnPicker({ schema, selected, onChange }: ColumnPickerProps) {
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name])

  const actions = (
    <>
      <Button variant="ghost" size="sm" onClick={() => onChange(schema.map((c) => c.name))}>Select All</Button>
      <Button variant="ghost" size="sm" onClick={() => onChange([])}>Deselect All</Button>
    </>
  )

  return (
    <SectionCard
      title={`Columns (${selected.length}/${schema.length})`}
      icon={<FileText className="h-5 w-5" />}
      actions={actions}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-auto">
        {schema.map((col) => (
          <label key={col.name} className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={selected.includes(col.name)} onCheckedChange={() => toggle(col.name)} />
            <span className="text-sm">{col.name}</span>
            <Badge variant="outline" className="text-xs ml-auto">{col.type}</Badge>
          </label>
        ))}
      </div>
    </SectionCard>
  )
}
