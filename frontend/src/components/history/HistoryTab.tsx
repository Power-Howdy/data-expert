import * as React from "react"
import { GitBranch, GitCompare, Settings2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingButton } from "@/components/common/LoadingButton"
import { PageHeader } from "@/components/common/PageHeader"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { formatBytes } from "@/lib/utils"
import { useEditStore } from "@/stores/useEditStore"
import { useVersionHistory } from "./useVersionHistory"
import { CommitItem } from "./CommitItem"
import { HistoryDialogs, type HistoryDialog } from "./HistoryDialogs"

export function HistoryTab() {
  const dataset = useSelectedDataset()
  const versions = useVersionHistory(dataset?.id)
  const pending = useEditStore((s) => (dataset ? s.changes[dataset.id]?.total ?? 0 : 0))
  const [dialog, setDialog] = React.useState<HistoryDialog>(null)
  const [compare, setCompare] = React.useState<string[]>([])
  const history = versions.history

  React.useEffect(() => setCompare([]), [dataset?.id])

  if (!dataset) {
    return <EmptyState icon={<GitBranch className="h-9 w-9" />} title="No dataset selected">Select a dataset to see its versions</EmptyState>
  }
  if (history && !history.tracking) {
    return (
      <EmptyState icon={<GitBranch className="h-9 w-9" />} title="No versions yet">
        Every “Save to file” becomes a version you can view, compare and restore. Tracking starts automatically on the first
        save, or now:
        <LoadingButton className="mt-4" onClick={versions.start} loading={versions.busy === "start"} loadingText="Starting...">
          Start tracking
        </LoadingButton>
      </EmptyState>
    )
  }

  const toggleCompare = (id: string) =>
    setCompare((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2)))
  const subtitle = history ? `${history.commits.length} versions · ${formatBytes(history.storage_bytes)} of history` : "Loading..."

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        title={`${dataset.name} History`} subtitle={subtitle}
        actions={
          <Button variant="outline" onClick={() => setDialog({ type: "settings" })} disabled={!history}>
            <Settings2 className="h-4 w-4" /> Settings
          </Button>
        }
      />
      {pending > 0 && (
        <p className="rounded-2xl border-2 border-accent/50 bg-accent/10 px-4 py-2 text-sm font-bold">
          You have {pending} unsaved {pending === 1 ? "change" : "changes"} in Browse. Save or discard them before restoring a version.
        </p>
      )}
      {compare.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-secondary/50 bg-secondary/10 px-4 py-2 text-sm font-bold">
          {compare.length === 1 ? "Select one more version to compare" : "2 versions selected"}
          <Button size="sm" className="ml-auto" disabled={compare.length < 2} onClick={() => setDialog({ type: "diff", a: compare[0], b: compare[1] })}>
            <GitCompare className="h-4 w-4" /> Compare
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCompare([])} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <ol className="relative space-y-3 pb-6 before:absolute before:bottom-6 before:left-[7px] before:top-4 before:w-0.5 before:bg-border">
        {history?.commits.map((commit) => (
          <CommitItem
            key={commit.id} commit={commit} comparing={compare.includes(commit.id)}
            restoring={versions.busy === `restore:${commit.id}`}
            onToggleCompare={() => toggleCompare(commit.id)}
            onPreview={() => setDialog({ type: "preview", commit })}
            onRestore={() => versions.restore(commit.id)}
            onTag={() => setDialog({ type: "tag", commit })}
            onUntag={versions.untag}
            onSaveAs={() => setDialog({ type: "save", commit })}
          />
        ))}
      </ol>
      <HistoryDialogs dialog={dialog} dataset={dataset} versions={versions} onClose={() => setDialog(null)} />
    </div>
  )
}
