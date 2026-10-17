import { ChartPanel } from "@/components/common/charts/ChartPanel"
import { ScatterPlot } from "@/components/common/charts/ScatterPlot"
import { NEGATIVE_COLOR } from "@/components/common/charts/chartTheme"

interface OutliersChartProps {
  outliers: { outliers: number[]; count: number; bounds?: { lower: number; upper: number } | null }
}

const fmt = (v: number) => String(Number(v.toPrecision(4)))

/** Each outlier as a dot, in file order, against the fences that make it an outlier. */
export function OutliersChart({ outliers }: OutliersChartProps) {
  const points = outliers.outliers.map((y, x) => ({ x: x + 1, y }))
  const { bounds } = outliers
  const references = bounds
    ? [
        { axis: "y" as const, value: bounds.upper, label: `upper ${fmt(bounds.upper)}`, used: points.some((p) => p.y > bounds.upper) },
        { axis: "y" as const, value: bounds.lower, label: `lower ${fmt(bounds.lower)}`, used: points.some((p) => p.y < bounds.lower) },
      ].filter((r) => r.used)
    : []
  const shown = points.length < outliers.count ? ` (first ${points.length} shown)` : ""
  return (
    <ChartPanel title="Outliers" hint={`Values far from the rest, in file order${shown}; dashed lines are the fences`}>
      <ScatterPlot
        points={points} xLabel="Order in file" yLabel="Value" color={NEGATIVE_COLOR} height={240}
        formatY={fmt} references={references}
      />
    </ChartPanel>
  )
}
