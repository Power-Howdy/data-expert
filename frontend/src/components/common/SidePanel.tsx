import * as React from "react"
import { X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SidePanelProps {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

export function SidePanel({ title, onClose, children }: SidePanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border-l h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ScrollArea className="flex-1 p-4 space-y-6">{children}</ScrollArea>
      </div>
    </div>
  )
}
