import { SimpleBarChart } from "@/components/common/SimpleBarChart"
import { AreaChartView } from "@/components/common/charts/AreaChartView"
import { BoxPlot } from "@/components/common/charts/BoxPlot"
import { ChartPanel } from "@/components/common/charts/ChartPanel"
import type { ColumnProfile } from "@/types"
import { boxFromFences, columnBox, cumulativeData, histogramData } from "./chartData"

interface NumericDistributionProps {
  distribution: { bins: number[]; bin_edges: number[]; stats?: Record<string, number>; note?: string }
  profile?: ColumnProfile
  bounds?: { lower: number; upper: number } | null
  threshold?: number
}

const pct = (v: number) => `${Number(v.toFixed(1))}%`

/** A numeric column three ways: how values are spread (histogram), how many fall below a value (cumulative
 * share) and where the middle half lies (box plot with outlier fences). */
export function NumericDistribution({ distribution, profile, bounds, threshold }: NumericDistributionProps) {
  const { bins, bin_edges: edges, stats } = distribution
  const box = bounds && stats?.min !== undefined && threshold !== undefined
    ? boxFromFences(stats, bounds, threshold)
    : profile ? columnBox(profile) : null
  return (
    <div className="grid gap-4">
      <ChartPanel title="Histogram" hint={distribution.note ?? "How many values fall in each range"}>
        <SimpleBarChart data={histogramData(bins, edges, 2)} xKey="range" height={220} />
      </ChartPanel>
      <ChartPanel title="Cumulative share" hint="Share of values at or below each point; read off medians and percentiles">
        <AreaChartView
          data={cumulativeData(bins, edges, 2)} xKey="upTo" yKey="share" height={200} stepped
          formatValue={pct} yDomain={[0, 100]}
        />
      </ChartPanel>
      {box && (
        <ChartPanel
          title="Spread"
          hint="The box holds the middle half of the values, the thick line is the median, the orange dot the mean; red dashes reach the outliers"
        >
          <BoxPlot stats={box} bounds={bounds} />
        </ChartPanel>
      )}
    </div>
  )
}
