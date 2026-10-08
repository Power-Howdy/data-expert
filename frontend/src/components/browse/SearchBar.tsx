import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchBarProps {
  query: string
  loading: boolean
  onQueryChange: (query: string) => void
  onSearch: () => void
}

/** Search box shown when the Search toggle is on; Enter or the button runs the search. */
export function SearchBar({ query, loading, onQueryChange, onSearch }: SearchBarProps) {
  return (
    <form
      className="flex max-w-xl items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      <Input
        autoFocus placeholder="Search across rows..." value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      <Button type="submit" variant="sky" size="sm" disabled={loading || !query.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Search
      </Button>
    </form>
  )
}
