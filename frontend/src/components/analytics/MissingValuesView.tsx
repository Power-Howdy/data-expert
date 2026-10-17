import { EmptyState } from "@/components/common/EmptyState"
import { ChartPanel } from "@/components/common/charts/ChartPanel"
import { HorizontalBarChart } from "@/components/common/charts/HorizontalBarChart"
import type { ColumnProfile } from "@/types"
import { MissingMatrix } from "./MissingMatrix"

interface MissingValuesViewProps {
  columns: ColumnProfile[]
  matrix?: Record<string, Record<string, number>>
}

const pct = (v: number) => `${Number(v.toFixed(1))}%`

/** Which columns have gaps (ranked bars), then which gaps occur together (co-occurrence matrix). */
export function MissingValuesView({ columns, matrix }: MissingValuesViewProps) {
  const gaps = columns
    .filter((c) => c.null_count > 0)
    .sort((a, b) => b.null_percentage - a.null_percentage)
    .map((c) => ({ name: c.name, value: c.null_percentage }))
  if (!gaps.length) return <EmptyState>No missing values: every column is complete.</EmptyState>
  return (
    <div className="grid gap-4 p-2">
      <ChartPanel title="Missing values by column" hint={`${gaps.length} of ${columns.length} columns have empty values`}>
        <HorizontalBarChart
          data={gaps} formatValue={pct} domain={[0, 100]} labelWidth={180}
          colorOf={(d) => (d.value > 50 ? "#ff4b4b" : d.value > 10 ? "#ff9600" : "#ffc800")}
        />
      </ChartPanel>
      {matrix && (
        <ChartPanel title="Missing together" hint="Each cell: of the rows missing the row's column, the share also missing the cell's column">
          <MissingMatrix matrix={matrix} columns={gaps.map((g) => g.name)} />
        </ChartPanel>
      )}
    </div>
  )
}
