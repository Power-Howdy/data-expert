import { ChartPanel } from "@/components/common/charts/ChartPanel"
import { DonutChart } from "@/components/common/charts/DonutChart"
import { HorizontalBarChart } from "@/components/common/charts/HorizontalBarChart"
import { ScatterPlot } from "@/components/common/charts/ScatterPlot"
import { colorAt } from "@/components/common/charts/chartTheme"
import type { ColumnProfile } from "@/types"
import { columnRoles, qualityPoints } from "./chartData"

const pct = (v: number) => `${Number(v.toFixed(1))}%`
const TOP_COLUMNS = 15

/** Every column on one page: where it sits between empty and unique, how distinct its values are, and how their
 * values repeat. */
export function QualityOverview({ columns }: { columns: ColumnProfile[] }) {
  const uniqueness = [...columns]
    .sort((a, b) => b.unique_percentage - a.unique_percentage)
    .slice(0, TOP_COLUMNS)
    .map((c) => ({ name: c.name, value: c.unique_percentage }))
  return (
    <div className="grid gap-4 p-2 xl:grid-cols-2">
      <ChartPanel
        className="xl:col-span-2" title="Column quality map"
        hint="Each dot is a column. Right means more missing values; top means nearly every value is different (IDs, free text); bottom means a few repeated values (categories)."
      >
        <ScatterPlot
          points={qualityPoints(columns)} xLabel="Missing" yLabel="Unique" formatX={pct} formatY={pct}
          xDomain={[0, 100]} yDomain={[0, 100]}
        />
      </ChartPanel>
      <ChartPanel title="Most distinct columns" hint="Distinct values as a share of non-empty rows">
        <HorizontalBarChart
          data={uniqueness} formatValue={pct} domain={[0, 100]} colorOf={(d) => colorAt(d.value > 90 ? 3 : d.value > 10 ? 1 : 0)}
        />
      </ChartPanel>
      <ChartPanel
        title="Column roles"
        hint="Constant: one value. Categories: at most 20 distinct values or under 5% distinct. Identifier-like: at least 90% distinct."
      >
        <DonutChart data={columnRoles(columns)} center={String(columns.length)} centerHint="columns" />
      </ChartPanel>
    </div>
  )
}
