/** Shared look for charts. SVG attributes cannot read CSS variables, so the theme colors are spelled out. */
export const CHART_COLORS = ["#58cc02", "#1cb0f6", "#ffc800", "#ce82ff", "#ff9600", "#14b8a6", "#ff4b4b", "#2b70c9"]
export const OTHER_COLOR = "#a3a3a3"
export const POSITIVE_COLOR = "#1cb0f6"
export const NEGATIVE_COLOR = "#ff4b4b"

export const axisTick = { fontSize: 10, fill: "#8a8a8a" }

export const tooltipProps = {
  contentStyle: { borderRadius: 12, border: "2px solid #e0e0e0", fontSize: 12, padding: "6px 10px" },
  labelStyle: { fontWeight: 700 },
}

export function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export interface NamedValue {
  name: string
  value: number
}

/** The largest `keep` entries, with the rest of `total` folded into "Other". */
export function withOther(data: NamedValue[], keep: number, total?: number): NamedValue[] {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, keep)
  const shown = head.reduce((sum, d) => sum + d.value, 0)
  const rest = (total ?? sorted.reduce((sum, d) => sum + d.value, 0)) - shown
  return rest > 0 ? [...head, { name: "Other", value: rest }] : head
}
