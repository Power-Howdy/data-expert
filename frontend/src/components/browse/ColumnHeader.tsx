import { ColumnSchema } from "@/types"

export function ColumnHeader({ column }: { column: ColumnSchema }) {
  return (
    <span
      className="flex items-baseline gap-1.5 whitespace-nowrap"
      title={`${column.name} · ${column.type}${column.nullable ? " · nullable" : ""}`}
    >
      <span className="normal-case text-foreground">{column.name}</span>
      <span className="text-[10px] font-semibold lowercase text-muted-foreground/70">{column.type}</span>
    </span>
  )
}
