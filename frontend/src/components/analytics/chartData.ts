import type { NamedValue } from "@/components/common/charts/chartTheme"
import type { BoxStats } from "@/components/common/charts/BoxPlot"
import type { ScatterPoint } from "@/components/common/charts/ScatterPlot"
import type { ColumnProfile } from "@/types"

/** Columns with this few distinct values read best as shares of a whole (a donut). */
export const FEW_CATEGORIES = 6

const short = (n: number, digits: number) => Number(n.toFixed(digits)).toLocaleString()

export function histogramData(bins: number[], edges: number[], digits = 1) {
  return bins.map((count, i) => ({ count, range: `${short(edges[i], digits)}–${short(edges[i + 1] ?? edges[i], digits)}` }))
}

/** Share of values at or below each bin's upper edge, in percent. */
export function cumulativeData(bins: number[], edges: number[], digits = 1) {
  const total = bins.reduce((a, b) => a + b, 0) || 1
  let running = 0
  return bins.map((count, i) => {
    running += count
    return { upTo: short(edges[i + 1] ?? edges[i], digits), share: (running / total) * 100 }
  })
}

export function columnBox(column: ColumnProfile): BoxStats | null {
  const q = column.quantiles
  if (column.min === undefined || column.max === undefined || !q) return null
  return { min: column.min, q1: q.q1, median: q.q2 ?? column.median ?? q.q1, q3: q.q3, max: column.max, mean: column.mean }
}

/** Quartiles recovered from IQR outlier fences (lower = Q1 - t·IQR, upper = Q3 + t·IQR). */
export function boxFromFences(stats: Record<string, number>, bounds: { lower: number; upper: number }, threshold: number): BoxStats {
  const iqr = (bounds.upper - bounds.lower) / (1 + 2 * threshold)
  return {
    min: stats.min, max: stats.max, median: stats.median, mean: stats.mean,
    q1: bounds.lower + threshold * iqr, q3: bounds.upper - threshold * iqr,
  }
}

export function topValues(values: Array<{ value: unknown; count: number }>): NamedValue[] {
  return values.map((v) => ({ name: v.value === null ? "(null)" : String(v.value), value: v.count }))
}

export function qualityPoints(columns: ColumnProfile[]): ScatterPoint[] {
  return columns.map((c) => ({ x: c.null_percentage, y: c.unique_percentage, name: `${c.name} (${c.type})` }))
}

/** Columns grouped by how their values repeat: one value, a few categories, a mix, or nearly all different. */
export function columnRoles(columns: ColumnProfile[]): NamedValue[] {
  const roles = { Constant: 0, Categories: 0, Mixed: 0, "Identifier-like": 0 }
  for (const c of columns) {
    if (c.unique_count <= 1) roles.Constant++
    else if (c.unique_count <= 20 || c.unique_percentage < 5) roles.Categories++
    else if (c.unique_percentage >= 90) roles["Identifier-like"]++
    else roles.Mixed++
  }
  return Object.entries(roles).filter(([, value]) => value > 0).map(([name, value]) => ({ name, value }))
}

/** Distinct column pairs ordered by the strength of their correlation. */
export function strongestPairs(correlations: Record<string, Record<string, number>>, limit = 12): NamedValue[] {
  const names = Object.keys(correlations)
  const pairs: NamedValue[] = []
  names.forEach((a, i) => names.slice(i + 1).forEach((b) => {
    const r = correlations[a]?.[b]
    if (r !== undefined && Number.isFinite(r)) pairs.push({ name: `${a} × ${b}`, value: r })
  }))
  return pairs.sort((p, q) => Math.abs(q.value) - Math.abs(p.value)).slice(0, limit)
}
