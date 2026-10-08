import { Info, Sparkles, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DataView } from "@/types/ai"

interface ViewBannerProps {
  view: DataView
  onDiscard: () => void
}

export function ViewBanner({ view, onDiscard }: ViewBannerProps) {
  return (
    <div className="space-y-2 rounded-2xl border-2 border-accent/50 bg-accent/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 shrink-0 text-accent-foreground" />
          <span className="shrink-0">AI result · {view.total.toLocaleString()} rows</span>
          {view.prompt && <span className="truncate font-semibold text-muted-foreground">“{view.prompt}”</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={onDiscard}>
          <Undo2 className="h-4 w-4" /> Back to original
        </Button>
      </div>
      {view.notes.map((note) => (
        <p key={note} className="flex items-start gap-2 text-xs font-semibold text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {note}
        </p>
      ))}
      <p className="text-xs font-semibold text-muted-foreground">
        Not saved yet. Use “Save as dataset” to keep it, or send another prompt to refine it.
      </p>
    </div>
  )
}
