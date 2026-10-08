import { SimpleBarChart, histogramToData } from "@/components/common/SimpleBarChart"
import { formatNumber } from "@/lib/utils"

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold text-muted-foreground">{children}</p>
}

export function DistributionChart({ distribution }: { distribution: any }) {
  if (!distribution) return <Caption>Loading distribution…</Caption>

  if (distribution.type === "histogram") {
    if (!distribution.bins?.length) return <Caption>No numeric values to chart.</Caption>
    return (
      <>
        {distribution.note && <Caption>{distribution.note}</Caption>}
        <SimpleBarChart data={histogramToData(distribution.bins, distribution.bin_edges, 2)} xKey="range" height={300} />
      </>
    )
  }

  const values: any[] = distribution.values ?? []
  if (!values.length) return <Caption>{distribution.note || "No values to chart."}</Caption>

  const data = values.map((v, i) => ({ value: v, count: distribution.counts[i] }))
  const unique = distribution.total_unique ?? values.length
  return (
    <>
      <Caption>
        {distribution.note ? `${distribution.note} · ` : ""}
        {unique > values.length ? `Top ${values.length} of ${formatNumber(unique)} distinct values` : `${formatNumber(unique)} distinct values`}
      </Caption>
      <SimpleBarChart data={data} xKey="value" height={300} categoricalX />
    </>
  )
}
