import { useState } from "react"
import { ChevronDown, ChevronRight, Sparkles, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { FunctionSpec } from "@/types/ai"
import { ParamList } from "./ParamList"

interface FunctionCardProps {
  fn: FunctionSpec
  onDelete?: (name: string) => void
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

export function FunctionCard({ fn, onDelete }: FunctionCardProps) {
  const [open, setOpen] = useState(false)
  const generated = fn.source === "generated"
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div className="rounded-xl border-2 border-border bg-card">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-2 p-3 text-left">
        <Chevron className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black">{fn.title || fn.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{fn.name}</span>
            {generated && <Badge variant="gold"><Sparkles className="mr-1 h-3 w-3" />AI-written</Badge>}
            <Badge variant="outline">{fn.category}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{fn.purpose}</p>
        </div>
      </button>
      {open && (
        <div className="space-y-3 border-t-2 border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Input"><p className="text-xs">{fn.input || "—"}</p></Detail>
            <Detail label="Output"><p className="text-xs">{fn.output || "—"}</p></Detail>
          </div>
          <Detail label="Parameters"><ParamList params={fn.params} /></Detail>
          {Object.keys(fn.example).length > 0 && (
            <Detail label="Example">
              <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify(fn.example, null, 1)}</pre>
            </Detail>
          )}
          {fn.code && (
            <Detail label={fn.prompt ? `Code (written for “${fn.prompt}”)` : "Code"}>
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs">{fn.code}</pre>
            </Detail>
          )}
          {generated && onDelete && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Used {fn.uses} time{fn.uses === 1 ? "" : "s"}</span>
              <Button variant="ghost" size="sm" onClick={() => onDelete(fn.name)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
