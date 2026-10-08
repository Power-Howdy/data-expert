import { Filter, Loader2, Plus, Replace, Save, Search, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BrowseActionsProps {
  onSearch?: () => void
  searchLoading?: boolean
  filterCount: number
  onToggleFilters: () => void
  aiOpen: boolean
  onToggleAI: () => void
  onSave: () => void
  /** Editing actions; omitted while an AI result is shown. */
  onAddRow?: () => void
  onReplace?: () => void
}

export function BrowseActions({
  onSearch, searchLoading, filterCount, onToggleFilters, aiOpen, onToggleAI, onSave, onAddRow, onReplace,
}: BrowseActionsProps) {
  return (
    <>
      <Button variant={aiOpen ? "default" : "outline"} size="sm" onClick={onToggleAI}>
        <Sparkles className="h-4 w-4" /> AI
      </Button>
      {onSearch && (
        <Button variant="sky" size="sm" onClick={onSearch} disabled={searchLoading}>
          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onToggleFilters}>
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
