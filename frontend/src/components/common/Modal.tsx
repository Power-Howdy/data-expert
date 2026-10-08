import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ModalProps {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex max-h-full w-full max-w-md flex-col rounded-3xl border-2 border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-border px-5 py-3">
          <h3 className="text-lg font-black">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t-2 border-border px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>
  )
}
