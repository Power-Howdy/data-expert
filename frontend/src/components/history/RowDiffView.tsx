import { formatNumber } from "@/lib/utils"
import type { RowDiff } from "@/types/version"

interface RowDiffViewProps {
  rows: RowDiff
}

function Sample({ title, rows, tone }: { title: string; rows: Array<Record<string, unknown>>; tone: string }) {
  if (!rows.length) return null
  return (
    <div className="space-y-1">
      <p className={`text-xs font-extrabold uppercase tracking-wide ${tone}`}>{title}</p>
      <pre className="max-h-48 overflow-auto rounded-xl border-2 border-border bg-muted/40 p-2 text-[11px]">
        {rows.map((row) => JSON.stringify(row)).join("\n")}
      </pre>
    </div>
  )
}

/** Rows that exist in only one of two versions (rows are compared by their values). */
export function RowDiffView({ rows }: RowDiffViewProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">
        <span className="text-destructive">{formatNumber(rows.only_in_from)} rows only in the older version</span>
        {" · "}
        <span className="text-primary">{formatNumber(rows.only_in_to)} rows only in the newer version</span>
      </p>
      <p className="text-xs font-semibold text-muted-foreground">
        Compared by the values of {rows.compared_columns.length} shared columns. An edited row counts once on each side.
      </p>
      <Sample title="Removed or changed (older values)" rows={rows.removed_sample} tone="text-destructive" />
      <Sample title="Added or changed (newer values)" rows={rows.added_sample} tone="text-primary" />
    </div>
  )
}
