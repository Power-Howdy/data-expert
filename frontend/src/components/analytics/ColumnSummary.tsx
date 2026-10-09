import { ColumnProfile } from "@/types"

const fixed = (n?: number) => (n !== undefined ? n.toFixed(2) : "N/A")
const raw = (n?: number) => (n !== undefined ? Number(n.toPrecision(6)) : "N/A")

export function ColumnSummary({ column }: { column: ColumnProfile }) {
  if (column.type === "integer" || column.type === "float") {
    return (
      <div className="shrink-0 text-right text-sm tabular-nums">
        <p>Min: {raw(column.min)}</p>
        <p>Max: {raw(column.max)}</p>
        <p>Mean: {fixed(column.mean)}</p>
        <p>Std: {fixed(column.std)}</p>
      </div>
    )
  }
  if (column.top_values && column.top_values.length > 0) {
    const top = column.top_values[0]
    return (
      <p
        className="line-clamp-2 min-w-0 flex-1 break-all text-right text-sm text-muted-foreground"
        title={String(top.value)}
      >
        Top: {String(top.value)} ({top.count})
      </p>
    )
  }
  return null
}
