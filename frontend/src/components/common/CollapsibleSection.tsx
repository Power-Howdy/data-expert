import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  open: boolean
  onToggle: () => void
  /** Shown next to the title while collapsed. */
  summary?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}

/** A titled section whose body can be hidden; the header stays visible. */
export function CollapsibleSection({ title, open, onToggle, summary, className, bodyClassName, children }: CollapsibleSectionProps) {
  return (
    <section className={cn("flex flex-col border-b-2 border-border", open && "min-h-0 flex-1", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50"
      >
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{title}</span>
        {!open && summary && (
          <span className="min-w-0 flex-1 truncate text-right text-xs font-bold text-foreground/70">{summary}</span>
        )}
      </button>
      {open && <div className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}>{children}</div>}
    </section>
  )
}
