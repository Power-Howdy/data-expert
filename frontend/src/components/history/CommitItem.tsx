import { Eye, GitCompare, RotateCcw, Save, Tag, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmButton } from "@/components/common/ConfirmButton"
import { cn, formatBytes, formatNumber } from "@/lib/utils"
import type { VersionInfo } from "@/types/version"
import { KIND_LABELS, shortId, statsText, timeAgo } from "./versionLabels"

interface CommitItemProps {
  commit: VersionInfo
  comparing?: boolean
  restoring?: boolean
  onToggleCompare: () => void
  onPreview: () => void
  onRestore: () => void
  onTag: () => void
  onUntag: (name: string) => void
  onSaveAs: () => void
}

/** One version in the history timeline, with its actions. */
export function CommitItem({ commit, comparing, restoring, onToggleCompare, onPreview, onRestore, onTag, onUntag, onSaveAs }: CommitItemProps) {
  const stats = statsText(commit.stats)
  const extra = commit.changes.length - 3

  return (
    <li className="relative pl-8">
      <span
        className={cn(
          "absolute left-0 top-4 h-4 w-4 rounded-full border-2",
          commit.head ? "border-primary bg-primary" : "border-border bg-card"
        )}
      />
      <div className={cn("space-y-2 rounded-2xl border-2 bg-card px-4 py-3", comparing ? "border-secondary" : "border-border")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-extrabold">{commit.message || KIND_LABELS[commit.kind]}</span>
          {commit.head && <Badge>Current</Badge>}
          {commit.kind !== "edit" && <Badge variant="outline">{KIND_LABELS[commit.kind]}</Badge>}
          {commit.tags.map((name) => (
            <Badge key={name} variant="gold" className="gap-1 normal-case">
              <Tag className="h-3 w-3" /> {name}
              <button type="button" aria-label={`Remove tag ${name}`} onClick={() => onUntag(name)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <p className="text-xs font-bold text-muted-foreground">
          <code className="font-mono">{shortId(commit.id)}</code> · {timeAgo(commit.created_at)}
          {commit.author && ` · ${commit.author}`} · {formatNumber(commit.row_count)} rows · {commit.columns.length} columns
          {stats && ` · ${stats}`}
          {commit.storage_bytes > 0 && ` · history ${formatBytes(commit.storage_bytes)}`}
        </p>
        {commit.changes.length > 1 && (
          <ul className="list-disc pl-5 text-xs font-semibold text-muted-foreground">
            {commit.changes.slice(0, 3).map((label, i) => <li key={i}>{label}</li>)}
            {extra > 0 && <li>and {extra} more</li>}
          </ul>
        )}
        {!commit.available && (
          <p className="text-xs font-bold text-destructive">This version can no longer be rebuilt, so it can't be viewed or restored.</p>
        )}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={onPreview} disabled={!commit.available}>
            <Eye className="h-4 w-4" /> View
          </Button>
          <Button variant={comparing ? "secondary" : "ghost"} size="sm" onClick={onToggleCompare} disabled={!commit.available}>
            <GitCompare className="h-4 w-4" /> {comparing ? "Selected" : "Compare"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onTag}>
            <Tag className="h-4 w-4" /> Tag
          </Button>
          <Button variant="ghost" size="sm" onClick={onSaveAs} disabled={!commit.available}>
            <Save className="h-4 w-4" /> Save as…
          </Button>
          {!commit.head && (
            <ConfirmButton variant="ghost" size="sm" onConfirm={onRestore} disabled={!commit.available || restoring} confirmLabel="Restore this version?">
              <RotateCcw className="h-4 w-4" /> {restoring ? "Restoring..." : "Restore"}
            </ConfirmButton>
          )}
        </div>
      </div>
    </li>
  )
}
