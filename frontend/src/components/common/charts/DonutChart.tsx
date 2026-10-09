import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { formatNumber } from "@/lib/utils"
import { OTHER_COLOR, colorAt, tooltipProps, truncate, type NamedValue } from "./chartTheme"

interface DonutChartProps {
  data: NamedValue[]
  /** Big text in the hole, e.g. a total or a percentage. */
  center?: string
  centerHint?: string
  size?: number
  colors?: string[]
  formatValue?: (value: number) => string
  legend?: boolean
}

/** Share of a whole: slices with a legend that shows each part's count and percentage. */
export function DonutChart({
  data, center, centerHint, size = 150, colors, formatValue = formatNumber, legend = true,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const color = (d: NamedValue, i: number) => (d.name === "Other" ? OTHER_COLOR : colors?.[i] ?? colorAt(i))
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%"
              paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}
            >
              {data.map((d, i) => <Cell key={d.name} fill={color(d, i)} />)}
            </Pie>
            <Tooltip {...tooltipProps} formatter={(v: number) => formatValue(v)} />
          </PieChart>
        </ResponsiveContainer>
        {center && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-lg font-black leading-none tabular-nums">{center}</span>
            {centerHint && <span className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{centerHint}</span>}
          </div>
        )}
      </div>
      {legend && (
        <ul className="min-w-0 flex-1 space-y-1 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color(d, i) }} />
              <span className="min-w-0 flex-1 truncate" title={d.name}>{truncate(d.name, 40)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatValue(d.value)} · {total ? ((d.value / total) * 100).toFixed(1) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
