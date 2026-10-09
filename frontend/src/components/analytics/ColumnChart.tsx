import { AreaChartView } from "@/components/common/charts/AreaChartView"
import { BoxPlot } from "@/components/common/charts/BoxPlot"
import { DonutChart } from "@/components/common/charts/DonutChart"
import { HorizontalBarChart } from "@/components/common/charts/HorizontalBarChart"
import { withOther } from "@/components/common/charts/chartTheme"
import type { ColumnProfile } from "@/types"
import { FEW_CATEGORIES, columnBox, histogramData, topValues } from "./chartData"

const TOP_BARS = 5

/** The chart that suits a column: numbers get their shape and a box plot, a few categories a donut, many
 * categories their most common values as bars. */
export function ColumnChart({ column }: { column: ColumnProfile }) {
  if (column.histogram?.bins.length) {
    const box = columnBox(column)
    return (
      <div className="mt-3 grid gap-2">
        <div className="h-16">
          <AreaChartView data={histogramData(column.histogram.bins, column.histogram.bin_edges)} xKey="range" compact />
        </div>
        {box && <BoxPlot stats={box} compact />}
      </div>
    )
  }
  if (!column.top_values?.length) return null
  const values = topValues(column.top_values)
  const filled = column.count - column.null_count
  if (column.type === "boolean" || column.unique_count <= FEW_CATEGORIES) {
    return (
      <div className="mt-3">
        <DonutChart data={withOther(values, FEW_CATEGORIES, filled)} size={96} />
      </div>
    )
  }
  if (values[0].value <= 1) {
    return <p className="mt-3 text-xs text-muted-foreground">Every value is different, so there are no common values to chart.</p>
  }
  return (
    <div className="mt-3">
      <HorizontalBarChart data={values.slice(0, TOP_BARS)} rowHeight={22} labelWidth={160} />
    </div>
  )
}
