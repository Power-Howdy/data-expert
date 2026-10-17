import { ChartPanel } from "@/components/common/charts/ChartPanel"
import { DonutChart } from "@/components/common/charts/DonutChart"
import { HorizontalBarChart } from "@/components/common/charts/HorizontalBarChart"
import { withOther } from "@/components/common/charts/chartTheme"
import { formatNumber } from "@/lib/utils"
import { FEW_CATEGORIES } from "./chartData"

interface CategoricalDistributionProps {
  distribution: { values: unknown[]; counts: number[]; total_unique?: number; total?: number; note?: string }
}

const TOP_BARS = 15

/** Text and other non-numeric values: the most common ones ranked, and how much of the column they cover. */
export function CategoricalDistribution({ distribution }: CategoricalDistributionProps) {
  const data = distribution.values.map((v, i) => ({ name: String(v), value: distribution.counts[i] }))
  const unique = distribution.total_unique ?? data.length
  const summary = unique > data.length
    ? `Top ${data.length} of ${formatNumber(unique)} distinct values`
    : `${formatNumber(unique)} distinct values`
  return (
    <div className="grid gap-4">
      <ChartPanel title="Most common values" hint={[distribution.note, summary].filter(Boolean).join(" · ")}>
        <HorizontalBarChart data={data.slice(0, TOP_BARS)} labelWidth={170} />
      </ChartPanel>
      <ChartPanel
        title="Share of values"
        hint={distribution.total ? `Out of ${formatNumber(distribution.total)} non-empty values` : "Among the values shown above"}
      >
        <DonutChart data={withOther(data, FEW_CATEGORIES, distribution.total)} size={140} />
      </ChartPanel>
    </div>
  )
}
