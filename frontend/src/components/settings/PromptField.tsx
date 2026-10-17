import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface PromptFieldProps {
  label: string
  hint?: string
  value: string
  defaultValue: string
  rows?: number
  onChange: (value: string) => void
}

export function PromptField({ label, hint, value, defaultValue, rows = 4, onChange }: PromptFieldProps) {
  const modified = value !== defaultValue
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
          {label}
          {modified && <span className="ml-2 normal-case tracking-normal text-primary">· customised</span>}
        </label>
        {modified && (
          <Button variant="ghost" size="sm" onClick={() => onChange(defaultValue)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      {hint && <p className="text-xs font-semibold text-muted-foreground">{hint}</p>}
    </div>
  )
}
