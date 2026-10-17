import { AlertTriangle, Loader2 } from "lucide-react"
import { formatNumber } from "@/lib/utils"
import type { StepsPreview } from "@/types/ai"
import { CellValue } from "./CellValue"

interface StepPreviewProps {
  preview: StepsPreview | null
  error: string
  loading: boolean
}

/** What the steps do to the first rows: an error to fix, or a small table of the result. */
export function StepPreview({ preview, error, loading }: StepPreviewProps) {
  if (error) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
      </p>
    )
  }
  if (!preview) {
    return loading
      ? <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Previewing…</p>
      : null
  }
  const names = preview.columns.map((c) => c.name)
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground">
        Preview on the first {formatNumber(preview.sample_rows)} rows: {formatNumber(preview.result_rows)} rows
        {preview.rows.length < preview.result_rows ? `, first ${preview.rows.length} shown` : ""}
      </p>
      <div className="max-h-64 overflow-auto rounded-xl border-2 border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>{names.map((n) => <th key={n} className="whitespace-nowrap px-2 py-1.5 text-left font-extrabold">{n}</th>)}</tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {names.map((n) => <td key={n} className="max-w-[240px] px-2 py-1"><CellValue value={row[n]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
