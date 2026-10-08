import { ColumnProfile } from "@/types"

const fixed = (n?: number) => (n !== undefined ? n.toFixed(2) : "N/A")
const raw = (n?: number) => (n !== undefined ? n : "N/A")

export function ColumnSummary({ column }: { column: ColumnProfile }) {
  if (column.type === "integer" || column.type === "float") {
    return (
      <div className="text-right text-sm">
        <p>Min: {raw(column.min)}</p>
        <p>Max: {raw(column.max)}</p>
        <p>Mean: {fixed(column.mean)}</p>
        <p>Std: {fixed(column.std)}</p>
      </div>
    )
  }
  if (column.top_values && column.top_values.length > 0) {
    return (
      <div className="text-right text-sm text-muted-foreground">
        Top: {column.top_values[0].value} ({column.top_values[0].count})
      </div>
    )
  }
  return null
}
