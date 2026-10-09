import { ChartPanel } from "@/components/common/charts/ChartPanel"
import { DonutChart } from "@/components/common/charts/DonutChart"
import { formatNumber, formatPercent } from "@/lib/utils"
import type { AnalyticsOverview } from "@/types"

const GOOD = "#58cc02"
const BAD = "#ff4b4b"

/** Dataset shape at a glance: column types, completeness and duplicate rows, each as shares of a whole. */
export function OverviewCharts({ overview }: { overview: AnalyticsOverview }) {
  const types = Object.entries(overview.column_types).map(([name, value]) => ({ name, value }))
  const missing = overview.missing_percentage
  const duplicates = overview.duplicate_rows
  const cells = overview.row_count * overview.column_count
  const missingCells = missing == null ? 0 : Math.round((cells * missing) / 100)
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartPanel title="Column types" hint="How many columns hold each kind of value">
        <DonutChart data={types} center={String(overview.column_count)} centerHint="columns" />
      </ChartPanel>
      {missing != null && (
        <ChartPanel title="Completeness" hint="Share of all cells that have a value">
          <DonutChart
            data={[{ name: "Filled cells", value: cells - missingCells }, { name: "Missing cells", value: missingCells }]}
            colors={[GOOD, BAD]} center={formatPercent(100 - missing)} centerHint="filled"
          />
        </ChartPanel>
      )}
      {duplicates != null && (
        <ChartPanel title="Duplicate rows" hint="Rows that repeat an earlier row exactly">
          <DonutChart
            data={[{ name: "Unique", value: overview.row_count - duplicates }, { name: "Duplicate", value: duplicates }]}
            colors={[GOOD, BAD]} center={formatNumber(duplicates)} centerHint="duplicates"
          />
        </ChartPanel>
      )}
    </div>
  )
}
