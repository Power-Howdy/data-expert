import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "sky" | "gold"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-lg border-2 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide",
        {
          "border-primary/30 bg-primary/15 text-primary": variant === "default",
          "border-secondary/30 bg-secondary/15 text-secondary": variant === "sky" || variant === "secondary",
          "border-accent/40 bg-accent/20 text-accent-foreground": variant === "gold",
          "border-destructive/30 bg-destructive/15 text-destructive": variant === "destructive",
          "border-border bg-card text-muted-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
)
Badge.displayName = "Badge"

export { Badge }
