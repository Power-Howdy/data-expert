import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts"
import { formatNumber } from "@/lib/utils"
import { CHART_COLORS, axisTick } from "./chartTheme"

export interface ScatterPoint {
  x: number
  y: number
  name?: string
}

interface ReferenceMark {
  value: number
  axis: "x" | "y"
  label: string
}

interface ScatterPlotProps {
  points: ScatterPoint[]
  xLabel: string
  yLabel: string
  height?: number
  color?: string
  xDomain?: [number | "auto", number | "auto"]
  yDomain?: [number | "auto", number | "auto"]
  formatX?: (value: number) => string
  formatY?: (value: number) => string
  references?: ReferenceMark[]
}

/** Points on two measures, e.g. columns by missing share and uniqueness, or outliers against their bounds. */
export function ScatterPlot({
  points, xLabel, yLabel, height = 280, color = CHART_COLORS[1], xDomain, yDomain,
  formatX = formatNumber, formatY = formatNumber, references = [],
}: ScatterPlotProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          type="number" dataKey="x" name={xLabel} tick={axisTick} tickFormatter={formatX} domain={xDomain ?? ["auto", "auto"]}
          label={{ value: xLabel, position: "insideBottom", offset: -14, fontSize: 11, fill: "#8a8a8a" }}
        />
        <YAxis
          type="number" dataKey="y" name={yLabel} tick={axisTick} tickFormatter={formatY} domain={yDomain ?? ["auto", "auto"]}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "#8a8a8a" }} width={56}
        />
        <ZAxis range={[60, 60]} />
        {references.map((r) => (
          <ReferenceLine
            key={`${r.axis}-${r.label}`} {...{ [r.axis]: r.value }} stroke="#ff4b4b" strokeDasharray="4 4" ifOverflow="extendDomain"
            label={{ value: r.label, fontSize: 10, fill: "#ff4b4b", position: r.axis === "y" ? "insideTopRight" : "top" }}
          />
        ))}
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as ScatterPoint | undefined
            if (!p) return null
            return (
              <div className="rounded-xl border-2 border-border bg-popover px-3 py-2 text-xs shadow">
                {p.name && <p className="mb-1 max-w-[220px] break-words font-bold">{p.name}</p>}
                <p>{xLabel}: {formatX(p.x)}</p>
                <p>{yLabel}: {formatY(p.y)}</p>
              </div>
            )
          }}
        />
        <Scatter data={points} fill={color} fillOpacity={0.75} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
