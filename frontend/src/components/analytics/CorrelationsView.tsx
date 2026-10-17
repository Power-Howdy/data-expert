import { ChartPanel } from "@/components/common/charts/ChartPanel"
import { HorizontalBarChart } from "@/components/common/charts/HorizontalBarChart"
import { NEGATIVE_COLOR, POSITIVE_COLOR } from "@/components/common/charts/chartTheme"
import { CorrelationHeatmap } from "./CorrelationHeatmap"
import { strongestPairs } from "./chartData"

interface CorrelationsViewProps {
  correlations: Record<string, Record<string, number>>
}

/** The strongest relationships first (diverging bars), then the full matrix. */
export function CorrelationsView({ correlations }: CorrelationsViewProps) {
  const columns = Object.keys(correlations)
  const pairs = strongestPairs(correlations)
  return (
    <div className="grid gap-4 p-2">
      <ChartPanel
        title="Strongest correlations"
        hint="Pairs of numeric columns that move together (blue, up to +1) or in opposite directions (red, down to −1)"
      >
        <HorizontalBarChart
          data={pairs} domain={[-1, 1]} labelWidth={220} formatValue={(v) => v.toFixed(2)}
          colorOf={(d) => (d.value >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR)}
        />
      </ChartPanel>
      <ChartPanel title="Correlation matrix" hint="Every pair of numeric columns">
        <CorrelationHeatmap correlations={correlations} columns={columns} />
      </ChartPanel>
    </div>
  )
}
