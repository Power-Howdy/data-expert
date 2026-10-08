import * as React from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  children: React.ReactNode
  className?: string
}

export function EmptyState({ children, className }: EmptyStateProps) {
  return (
    <div className={cn("flex h-full items-center justify-center text-muted-foreground", className)}>
      {children}
    </div>
  )
}
