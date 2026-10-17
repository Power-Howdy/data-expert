import * as React from "react"
import { FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
  title?: string
  /** Shown below the text, e.g. a button. */
  action?: React.ReactNode
}

export function EmptyState({ children, className, icon, title, action }: EmptyStateProps) {
  return (
    <div className={cn("flex h-full min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center", className)}>
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-2 border-border bg-muted text-primary shadow-duo animate-bounce-soft">
        {icon ?? <FolderOpen className="h-9 w-9" />}
      </div>
      {title && <h3 className="text-xl font-extrabold">{title}</h3>}
      <p className="max-w-sm text-sm font-semibold text-muted-foreground">{children}</p>
      {action}
    </div>
  )
}
