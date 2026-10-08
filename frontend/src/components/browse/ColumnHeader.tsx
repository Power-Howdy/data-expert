import { Badge } from "@/components/ui/badge"
import { ColumnSchema } from "@/types"

export function ColumnHeader({ column }: { column: ColumnSchema }) {
  return (
    <div className="flex items-center gap-1">
      <span>{column.name}</span>
      <Badge variant="outline" className="text-xs">{column.type}</Badge>
      {column.nullable && <Badge variant="secondary" className="text-xs">nullable</Badge>}
    </div>
  )
}
