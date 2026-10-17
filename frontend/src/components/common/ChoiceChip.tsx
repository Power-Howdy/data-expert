import * as React from "react"
import { cn } from "@/lib/utils"

interface ChoiceChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function ChoiceChip({ active, className, ...props }: ChoiceChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border-2 px-3 py-1.5 text-left text-xs font-bold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted",
        className
      )}
      {...props}
    />
  )
}
