import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatNumber } from "@/lib/utils"
import { CHART_COLORS, axisTick, tooltipProps, truncate, type NamedValue } from "./chartTheme"

interface HorizontalBarChartProps {
  data: NamedValue[]
  formatValue?: (value: number) => string
  /** Color of each bar; one color for all by default. */
  colorOf?: (item: NamedValue, index: number) => string
  labelWidth?: number
  domain?: [number | "auto", number | "auto"]
  rowHeight?: number
}

/** Ranked values with readable labels: top values, per-column measures, signed scores (bars grow from zero). */
export function HorizontalBarChart({
  data, formatValue = formatNumber, colorOf, labelWidth = 130, domain, rowHeight = 26,
}: HorizontalBarChartProps) {
  const signed = data.some((d) => d.value < 0)
  return (
    <ResponsiveContainer width="100%" height={data.length * rowHeight + 30}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
        <XAxis type="number" tick={axisTick} allowDecimals={data.some((d) => !Number.isInteger(d.value))} tickFormatter={formatValue} domain={domain ?? (signed ? ["auto", "auto"] : [0, "auto"])} />
        <YAxis
          type="category" dataKey="name" width={labelWidth} tick={axisTick} interval={0}
          tickFormatter={(v: string) => truncate(String(v), Math.floor(labelWidth / 6))}
        />
        <Tooltip {...tooltipProps} formatter={(v: number) => formatValue(v)} cursor={{ fillOpacity: 0.15 }} />
        {signed && <ReferenceLine x={0} stroke="#8a8a8a" />}
        <Bar dataKey="value" radius={4} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.name} fill={colorOf ? colorOf(d, i) : CHART_COLORS[1]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
