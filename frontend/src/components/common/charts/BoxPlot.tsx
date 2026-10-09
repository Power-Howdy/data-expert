import { CHART_COLORS } from "./chartTheme"

export interface BoxStats {
  min: number
  q1: number
  median: number
  q3: number
  max: number
  mean?: number
}

interface BoxPlotProps {
  stats: BoxStats
  /** Outlier fences; values outside them are drawn as a dashed tail. */
  bounds?: { lower: number; upper: number } | null
  format?: (value: number) => string
  compact?: boolean
}

const W = 1000

/** Five-number summary: the middle half as a box, the median as a line, the mean as a dot. */
export function BoxPlot({ stats, bounds, format = (v) => String(Number(v.toPrecision(4))), compact }: BoxPlotProps) {
  const { min, q1, median, q3, max, mean } = stats
  const span = max - min || 1
  const x = (v: number) => ((Math.min(Math.max(v, min), max) - min) / span) * W
  const lowFence = bounds ? Math.max(bounds.lower, min) : min
  const highFence = bounds ? Math.min(bounds.upper, max) : max
  const h = compact ? 28 : 44
  const mid = h / 2
  const color = CHART_COLORS[1]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
        <line x1={x(min)} x2={x(lowFence)} y1={mid} y2={mid} stroke="#ff4b4b" strokeDasharray="12 10" strokeWidth={3} />
        <line x1={x(highFence)} x2={x(max)} y1={mid} y2={mid} stroke="#ff4b4b" strokeDasharray="12 10" strokeWidth={3} />
        <line x1={x(lowFence)} x2={x(highFence)} y1={mid} y2={mid} stroke={color} strokeWidth={3} />
        <rect x={x(q1)} y={4} width={Math.max(x(q3) - x(q1), 4)} height={h - 8} rx={8} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={3} />
        <line x1={x(median)} x2={x(median)} y1={4} y2={h - 4} stroke={color} strokeWidth={8} />
        {mean !== undefined && <circle cx={x(mean)} cy={mid} r={compact ? 6 : 8} fill={CHART_COLORS[4]} />}
      </svg>
      {!compact && (
        <div className="mt-1 grid grid-cols-5 text-center text-[11px] tabular-nums text-muted-foreground">
          {[["min", min], ["Q1", q1], ["median", median], ["Q3", q3], ["max", max]].map(([label, value]) => (
            <span key={label as string}>
              <span className="block font-bold uppercase">{label}</span>
              {format(value as number)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
