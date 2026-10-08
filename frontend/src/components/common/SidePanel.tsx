import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidePanelProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

export function SidePanel({ title, subtitle, onClose, children }: SidePanelProps) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l-2 border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b-2 border-border px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs font-bold text-muted-foreground">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  )
}
