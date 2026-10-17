import { FolderOpen, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FolderPickerProps {
  path: string
  loading: boolean
  onPick: () => void
  onRefresh: () => void
}

export function FolderPicker({ path, loading, onPick, onRefresh }: FolderPickerProps) {
  return (
    <div className="space-y-3 border-b-2 border-border px-4 pb-4">
      <Button
        variant="sky"
        className="w-full justify-center"
        onClick={onPick}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
        Choose folder
      </Button>
      {path ? (
        <div className="flex items-start gap-2 rounded-xl border-2 border-border bg-muted/50 p-2.5">
          <p className="min-w-0 flex-1 break-all text-xs font-bold leading-snug text-foreground/80" title={path}>
            {path}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh folder"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs font-semibold text-muted-foreground">
          Pick a folder to browse datasets
        </p>
      )}
    </div>
  )
}
