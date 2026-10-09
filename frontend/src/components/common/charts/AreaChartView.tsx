import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatNumber } from "@/lib/utils"
import { CHART_COLORS, axisTick, tooltipProps } from "./chartTheme"

interface AreaChartViewProps {
  data: Array<Record<string, unknown>>
  xKey: string
  yKey?: string
  height?: number | `${number}%`
  color?: string
  /** Steps instead of a smooth curve, e.g. for cumulative shares. */
  stepped?: boolean
  /** Hide axes and grid for a compact sparkline. */
  compact?: boolean
  formatValue?: (value: number) => string
  yDomain?: [number, number]
}

/** A filled curve: the shape of a distribution, or a cumulative share. */
export function AreaChartView({
  data, xKey, yKey = "count", height = "100%", color = CHART_COLORS[0], stepped, compact, formatValue = formatNumber, yDomain,
}: AreaChartViewProps) {
  const id = `area-${xKey}-${yKey}-${color.slice(1)}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={compact ? { top: 2, right: 0, bottom: 0, left: 0 } : { top: 8, right: 12, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        {!compact && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
        <XAxis dataKey={xKey} hide={compact} tick={axisTick} minTickGap={24} />
        <YAxis hide={compact} tick={axisTick} tickFormatter={formatValue} domain={yDomain ?? [0, "auto"]} width={44} />
        <Tooltip {...tooltipProps} formatter={(v: number) => formatValue(v)} />
        <Area
          type={stepped ? "stepAfter" : "monotone"} dataKey={yKey} stroke={color} strokeWidth={2}
          fill={`url(#${id})`} isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
