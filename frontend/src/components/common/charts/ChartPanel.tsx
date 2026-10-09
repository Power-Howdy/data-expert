import * as React from "react"
import { cn } from "@/lib/utils"

interface ChartPanelProps {
  title: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** A titled frame for one chart, with an optional one-line explanation. */
export function ChartPanel({ title, hint, className, children }: ChartPanelProps) {
  return (
    <section className={cn("min-w-0 rounded-2xl border-2 border-border bg-card p-4", className)}>
      <h4 className="text-sm font-extrabold">{title}</h4>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {!hint && <div className="mb-3" />}
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}
