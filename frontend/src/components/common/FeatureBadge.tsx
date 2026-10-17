import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FeatureState } from "@/types"

interface FeatureBadgeProps {
  icon: LucideIcon
  state: FeatureState
  /** Tooltip for each state; states without one render nothing. */
  titles: Partial<Record<FeatureState, string>>
}

const STYLES: Record<FeatureState, string> = {
  ready: "bg-secondary/15 text-secondary",
  building: "bg-primary/15 text-primary animate-pulse",
  missing: "text-muted-foreground/40",
  error: "bg-destructive/15 text-destructive",
  not_needed: "",
}

/** A small icon-only status badge: colored when a feature is ready, faded when it is missing. */
export function FeatureBadge({ icon: Icon, state, titles }: FeatureBadgeProps) {
  const title = titles[state]
  if (!title) return null
  return (
    <span
      title={title} aria-label={title} role="img"
      className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md", STYLES[state])}
    >
      <Icon className="h-3 w-3" strokeWidth={3} />
    </span>
  )
}
