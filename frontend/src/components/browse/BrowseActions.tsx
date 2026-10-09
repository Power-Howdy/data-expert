import { Filter, Plus, Replace, Save, Search, Sparkles, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"

export type BrowsePanel = "ai" | "tools" | "search" | "filters"

interface BrowseActionsProps {
  isOpen: (panel: BrowsePanel) => boolean
  onToggle: (panel: BrowsePanel) => void
  filterCount: number
  /** False while a transform result is shown, which cannot be searched. */
  canSearch: boolean
  onSave: () => void
  /** Editing actions; omitted while a transform result is shown. */
  onAddRow?: () => void
  onReplace?: () => void
}

export function BrowseActions({ isOpen, onToggle, filterCount, canSearch, onSave, onAddRow, onReplace }: BrowseActionsProps) {
  const toggle = (panel: BrowsePanel) => ({
    variant: isOpen(panel) ? ("default" as const) : ("outline" as const),
    size: "sm" as const,
    onClick: () => onToggle(panel),
  })
  return (
    <>
      <Button {...toggle("ai")}>
        <Sparkles className="h-4 w-4" /> AI
      </Button>
      <Button {...toggle("tools")}>
        <Wrench className="h-4 w-4" /> Tools
      </Button>
      {canSearch && (
        <Button {...toggle("search")}>
          <Search className="h-4 w-4" /> Search
        </Button>
      )}
      <Button {...toggle("filters")}>
        <Filter className="h-4 w-4" /> Filters ({filterCount})
      </Button>
      {onAddRow && (
        <Button variant="outline" size="sm" onClick={onAddRow}>
          <Plus className="h-4 w-4" /> Add row
        </Button>
      )}
      {onReplace && (
        <Button variant="outline" size="sm" onClick={onReplace}>
          <Replace className="h-4 w-4" /> Find & replace
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onSave}>
        <Save className="h-4 w-4" /> Save as dataset
      </Button>
    </>
  )
}
