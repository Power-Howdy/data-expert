import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max: number
  label?: string
  className?: string
}

export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const known = max > 0
  const percent = known ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-muted-foreground">
        <span className="min-w-0 truncate">{label}</span>
        {known && <span className="shrink-0 tabular-nums">{value.toLocaleString()} / {max.toLocaleString()} rows</span>}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-primary transition-[width] duration-300", !known && "w-1/3 animate-pulse")}
          style={known ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  )
}
