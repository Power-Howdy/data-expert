import { Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/common/ProgressBar"
import type { AIJob } from "@/types/ai"

/** Progress of a running transform with a Stop button. */
export function JobProgress({ job, onCancel }: { job: AIJob; onCancel: () => void }) {
  return (
    <div className="flex items-end gap-3">
      <ProgressBar className="flex-1" value={job.done} max={job.total} label={job.message || "Working..."} />
      <Button variant="outline" size="sm" onClick={onCancel}>
        <Square className="h-3.5 w-3.5" /> Stop
      </Button>
    </div>
  )
}
