import { SimpleBarChart, histogramToData } from "@/components/common/SimpleBarChart"

export function DistributionChart({ distribution }: { distribution: any }) {
  if (distribution.type === "histogram") {
    return (
      <SimpleBarChart
        data={histogramToData(distribution.bins, distribution.bin_edges, 2)}
        xKey="range"
        height={300}
      />
    )
  }
  if (distribution.type === "bar") {
    const data = distribution.values.map((v: any, i: number) => ({ value: v, count: distribution.counts[i] }))
    return <SimpleBarChart data={data} xKey="value" height={300} categoricalX />
  }
  return null
}
