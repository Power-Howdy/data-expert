import { Filter, Plus, Replace, Save, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BrowseActionsProps {
  searchOpen: boolean
  /** Omitted while an AI result is shown, which cannot be searched. */
  onToggleSearch?: () => void
  filterCount: number
  filtersOpen: boolean
  onToggleFilters: () => void
  aiOpen: boolean
  onToggleAI: () => void
  onSave: () => void
  /** Editing actions; omitted while an AI result is shown. */
  onAddRow?: () => void
  onReplace?: () => void
}

export function BrowseActions({
  searchOpen, onToggleSearch, filterCount, filtersOpen, onToggleFilters, aiOpen, onToggleAI, onSave, onAddRow,
  onReplace,
}: BrowseActionsProps) {
  return (
    <>
      <Button variant={aiOpen ? "default" : "outline"} size="sm" onClick={onToggleAI}>
        <Sparkles className="h-4 w-4" /> AI
      </Button>
      {onToggleSearch && (
        <Button variant={searchOpen ? "default" : "outline"} size="sm" onClick={onToggleSearch}>
          <Search className="h-4 w-4" /> Search
        </Button>
      )}
      <Button variant={filtersOpen ? "default" : "outline"} size="sm" onClick={onToggleFilters}>
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
