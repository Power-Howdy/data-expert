import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

interface SimpleBarChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  yKey?: string
  height?: number | `${number}%`
  categoricalX?: boolean
}

export function SimpleBarChart({ data, xKey, yKey = "count", height = "100%", categoricalX }: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} type={categoricalX ? "category" : undefined} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey={yKey} fill="#3b82f6" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function histogramToData(bins: number[], binEdges: number[], digits = 1) {
  return bins.map((count, i) => ({
    count,
    range: `${binEdges[i].toFixed(digits)}-${binEdges[i + 1]?.toFixed(digits) || ""}`,
  }))
}
