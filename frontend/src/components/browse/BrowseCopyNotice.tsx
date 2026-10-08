import { Trash2, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmButton } from "@/components/common/ConfirmButton"
import { LoadingButton } from "@/components/common/LoadingButton"
import { ProgressBar } from "@/components/common/ProgressBar"
import { formatBytes } from "@/lib/utils"
import type { BrowseCopyStatus } from "@/types"

interface BrowseCopyNoticeProps {
  status: BrowseCopyStatus | null
  /** Size of the data file, as an estimate of the copy's size. */
  fileBytes: number
  busy: boolean
  dismissed: boolean
  onBuild: () => void
  onRemove: () => void
  onDismiss: () => void
}

/** Offers, tracks and removes a browse copy for files whose deep pages load slowly. */
export function BrowseCopyNotice({ status, fileBytes, busy, dismissed, onBuild, onRemove, onDismiss }: BrowseCopyNoticeProps) {
  if (!status) return null
  const offer = status.state === "missing" || status.state === "error"
  if (offer && (!status.needed || dismissed)) return null

  if (status.state === "ready") {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Zap className="h-3.5 w-3.5 text-primary" />
        Optimized for browsing · the copy uses {formatBytes(status.size_bytes)}
        <ConfirmButton variant="ghost" size="sm" onConfirm={onRemove} disabled={busy} confirmLabel="Delete copy?">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </ConfirmButton>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Zap className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-sm font-bold">
          {status.state === "building" ? "Optimizing for browsing…" : "Pages deep in this file load slowly"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {status.state === "building" ? (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
              <X className="h-4 w-4" /> Cancel
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onDismiss}>Not now</Button>
              <LoadingButton size="sm" onClick={onBuild} loading={busy} loadingText="Starting...">
                <Zap className="h-4 w-4" /> Optimize for browsing
              </LoadingButton>
            </>
          )}
        </div>
      </div>
      {status.state === "building" && <ProgressBar value={status.done} max={status.total} label="Copying rows" />}
      {status.state === "error" && <p className="text-xs font-bold text-destructive">Could not build the copy: {status.error}</p>}
      <p className="text-xs font-semibold text-muted-foreground">
        {status.state === "building"
          ? "You can keep working; pages switch to the copy as soon as it is ready."
          : `The file stores its rows in very large blocks, so jumping far into it takes seconds. A browse copy with small blocks makes every page load instantly. It needs up to ${formatBytes(fileBytes)} of disk, is built in the background and is rebuilt automatically when you save changes.`}
      </p>
    </div>
  )
}
