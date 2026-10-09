import { Play, Plus, ShieldCheck, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/common/SectionCard"
import type { AITransform } from "./useAITransform"
import type { DataTools as Tools } from "./useDataTools"
import { JobProgress } from "./JobProgress"
import { ParamForm } from "./ParamForm"
import { StepList } from "./StepList"
import { StepPreview } from "./StepPreview"
import { ToolPicker } from "./ToolPicker"

interface DataToolsProps {
  tools: Tools
  /** The shared transform state: its job progress, and its result view that new steps refine. */
  transform: Pick<AITransform, "job" | "running" | "cancel" | "view">
  columns: string[]
}

/** Build a pipeline from the function library by hand, preview it on the first rows, then run it on all rows. */
export function DataTools({ tools, transform, columns }: DataToolsProps) {
  const { job, running, cancel: onCancel } = transform
  const refining = Boolean(transform.view)
  const previewColumns = tools.preview?.columns.map((c) => c.name)
  return (
    <SectionCard title="Data tools" icon={<Wrench className="h-4 w-4" />} contentClassName="space-y-4">
      <p className="text-xs font-semibold text-muted-foreground">
        {refining
          ? "Steps now work on the current result."
          : "Pick a tool, fill in its settings and add it as a step. Steps run in order, without AI."}
      </p>
      <ToolPicker functions={tools.functions} selected={tools.selected} onSelect={tools.select} />
      {tools.selected && (
        <div key={tools.selected.name} className="space-y-3 rounded-2xl border-2 border-border bg-muted/30 p-4">
          <ParamForm
            spec={tools.selected} draft={tools.draft} onChange={tools.setParam}
            columns={tools.steps.length && previewColumns ? previewColumns : columns}
          />
          {tools.formError && <p className="text-xs font-bold text-destructive">{tools.formError}</p>}
          <Button size="sm" onClick={tools.addStep} disabled={running}>
            <Plus className="h-4 w-4" /> Add step
          </Button>
        </div>
      )}
      {tools.steps.length > 0 && (
        <>
          <StepList steps={tools.steps} onMove={tools.moveStep} onRemove={tools.removeStep} disabled={running} />
          <StepPreview preview={tools.preview} error={tools.previewError} loading={tools.previewing} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Runs locally on all rows; you review the result first.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={tools.clearSteps} disabled={running}>
                <X className="h-4 w-4" /> Clear
              </Button>
              <Button size="sm" onClick={tools.run} disabled={running || Boolean(tools.previewError)}>
                <Play className="h-4 w-4" /> Run {tools.steps.length} step{tools.steps.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </>
      )}
      {running && job && <JobProgress job={job} onCancel={onCancel} />}
    </SectionCard>
  )
}
