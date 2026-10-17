import { ArrowDown, ArrowUp, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PlanStep } from "@/types/ai"
import { stepSummary } from "./toolParams"

interface StepListProps {
  steps: PlanStep[]
  onMove: (index: number, by: -1 | 1) => void
  onRemove: (index: number) => void
  disabled?: boolean
}

/** The pipeline being built, in run order, with reorder and remove controls. */
export function StepList({ steps, onMove, onRemove, disabled }: StepListProps) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border-2 border-border bg-card px-3 py-2 text-sm">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{step.op}</Badge>
              <span className="font-bold">{step.description}</span>
            </div>
            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{stepSummary(step)}</p>
          </div>
          <div className="flex shrink-0">
            <Button variant="ghost" size="sm" aria-label="Move up" disabled={disabled || i === 0} onClick={() => onMove(i, -1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="sm" aria-label="Move down" disabled={disabled || i === steps.length - 1}
              onClick={() => onMove(i, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" aria-label="Remove step" disabled={disabled} onClick={() => onRemove(i)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ol>
  )
}
