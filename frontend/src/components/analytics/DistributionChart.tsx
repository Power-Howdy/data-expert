import type { ColumnProfile } from "@/types"
import { CategoricalDistribution } from "./CategoricalDistribution"
import { NumericDistribution } from "./NumericDistribution"

export function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold text-muted-foreground">{children}</p>
}

interface DistributionChartProps {
  distribution: any
  profile?: ColumnProfile
  outliers?: any
}

/** Numbers get their shape, cumulative share and box plot; other values their top values and shares. */
export function DistributionChart({ distribution, profile, outliers }: DistributionChartProps) {
  if (!distribution) return <Caption>Loading distribution…</Caption>
  if (distribution.type === "histogram") {
    if (!distribution.bins?.length) return <Caption>No numeric values to chart.</Caption>
    return <NumericDistribution distribution={distribution} profile={profile} bounds={outliers?.bounds} threshold={outliers?.threshold} />
  }
  if (!distribution.values?.length) return <Caption>{distribution.note || "No values to chart."}</Caption>
  return <CategoricalDistribution distribution={distribution} />
}
