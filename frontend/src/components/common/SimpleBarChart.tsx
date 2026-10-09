import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CHART_COLORS, axisTick, tooltipProps } from "./charts/chartTheme"

interface SimpleBarChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  yKey?: string
  height?: number | `${number}%`
  categoricalX?: boolean
  color?: string
}

export function SimpleBarChart({
  data, xKey, yKey = "count", height = "100%", categoricalX, color = CHART_COLORS[1],
}: SimpleBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barCategoryGap={1}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis dataKey={xKey} tick={axisTick} type={categoricalX ? "category" : undefined} minTickGap={12} />
        <YAxis tick={axisTick} width={48} tickFormatter={(v: number) => v.toLocaleString()} />
        <Tooltip {...tooltipProps} cursor={{ fill: "rgba(0,0,0,0.05)" }} />
        <Bar dataKey={yKey} fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
