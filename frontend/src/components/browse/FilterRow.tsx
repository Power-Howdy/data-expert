import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SimpleSelect, toOptions } from "@/components/common/SimpleSelect"
import { ColumnFilter, filterOperators } from "./filterOperators"

interface FilterRowProps {
  filter: ColumnFilter
  columns: string[]
  onChange: (field: keyof ColumnFilter, value: string) => void
  onRemove: () => void
}

export function FilterRow({ filter, columns, onChange, onRemove }: FilterRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SimpleSelect
        value={filter.column}
        onChange={(v) => onChange("column", v)}
        options={toOptions(columns)}
        placeholder="Column"
        className="w-40"
      />
      <SimpleSelect
        value={filter.operator}
        onChange={(v) => onChange("operator", v)}
        options={filterOperators}
        placeholder="Operator"
        className="w-36"
      />
      <Input
        value={filter.value}
        onChange={(e) => onChange("value", e.target.value)}
        placeholder="Value"
        className="flex-1 min-w-[150px]"
      />
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}
