import type * as React from "react"
import { Rows3 } from "lucide-react"
import { SidePanel } from "@/components/common/SidePanel"
import { LoadingButton } from "@/components/common/LoadingButton"
import { formatNumber } from "@/lib/utils"
import { useVersionDiff } from "./useVersionDiff"
import { RowDiffView } from "./RowDiffView"
import { KIND_LABELS, shortId, statsText } from "./versionLabels"

interface DiffPanelProps {
  datasetId: string
  a: string
  b: string
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

/** What changed between two versions: row count, columns, the commits in between and (on request) rows. */
export function DiffPanel({ datasetId, a, b, onClose }: DiffPanelProps) {
  const { diff, loading, comparingRows, compareRows } = useVersionDiff(datasetId, a, b)
  const subtitle = diff ? `${shortId(diff.from_id)} → ${shortId(diff.to_id)}` : undefined
  const delta = diff?.row_delta ?? 0

  return (
    <SidePanel title="Compare versions" subtitle={subtitle} onClose={onClose}>
      {loading && <p className="text-sm font-bold text-muted-foreground">Comparing...</p>}
      {diff && (
        <>
          <Section title="Rows">
            <p className="text-sm font-bold">
              {delta === 0 ? "Same number of rows" : `${delta > 0 ? "+" : ""}${formatNumber(delta)} rows`}
            </p>
          </Section>
          <Section title="Columns">
            {diff.schema_changes.length ? (
              <ul className="space-y-1 text-sm font-semibold">
                {diff.schema_changes.map((c) => (
                  <li key={c.name}>
                    <code className="font-mono font-bold">{c.name}</code>{" "}
                    {!c.before ? "added" : !c.after ? "removed" : `${c.before} → ${c.after}`}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">No column changes</p>
            )}
          </Section>
          <Section title={`${diff.commits.length} versions in between`}>
            <ol className="space-y-1 text-sm font-semibold">
              {diff.commits.map((c) => (
                <li key={c.id}>
                  <code className="font-mono text-xs text-muted-foreground">{shortId(c.id)}</code> {c.message || KIND_LABELS[c.kind]}
                  {statsText(c.stats) && <span className="text-xs text-muted-foreground"> · {statsText(c.stats)}</span>}
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Row changes">
            {diff.rows ? (
              <RowDiffView rows={diff.rows} />
            ) : (
              <LoadingButton variant="outline" size="sm" onClick={compareRows} loading={comparingRows} loadingText="Comparing rows...">
                <Rows3 className="h-4 w-4" /> Compare rows
              </LoadingButton>
            )}
          </Section>
        </>
      )}
    </SidePanel>
  )
}
