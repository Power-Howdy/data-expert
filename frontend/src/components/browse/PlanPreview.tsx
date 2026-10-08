import { AlertTriangle, Play, Sparkles, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PlanStep, TransformPlan } from "@/types/ai"

interface PlanPreviewProps {
  plan: TransformPlan
  onRun: () => void
  onDismiss: () => void
  running?: boolean
}

function summarize(step: PlanStep) {
  return Object.entries(step.params)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ")
}

export function PlanPreview({ plan, onRun, onDismiss, running }: PlanPreviewProps) {
  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
      {plan.explanation && <p className="text-sm font-semibold">{plan.explanation}</p>}
      <ol className="space-y-2">
        {plan.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-card text-xs font-black">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={step.op === "ai_column" ? "gold" : "outline"}>
                  {step.op === "ai_column" && <Sparkles className="mr-1 h-3 w-3" />}
                  {step.op}
                </Badge>
                <span className="font-bold">{step.description}</span>
              </div>
              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{summarize(step)}</p>
            </div>
          </li>
        ))}
      </ol>
      {plan.warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {w}
        </p>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">
          {plan.ai_rows > 0 ? `About ${plan.ai_rows.toLocaleString()} rows will be sent to the model` : "No model calls needed"}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss} disabled={running}>
            <X className="h-4 w-4" /> Discard
          </Button>
          <Button size="sm" onClick={onRun} disabled={running}>
            <Play className="h-4 w-4" /> Run plan
          </Button>
        </div>
      </div>
    </div>
  )
}
