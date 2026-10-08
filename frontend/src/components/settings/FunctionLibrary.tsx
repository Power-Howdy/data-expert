import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ChoiceChip } from "@/components/common/ChoiceChip"
import { FunctionCard } from "./FunctionCard"
import { useFunctionLibrary } from "./useFunctionLibrary"

export function FunctionLibrary() {
  const lib = useFunctionLibrary()

  if (lib.loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {lib.functions.length} functions ({lib.generatedCount} written by AI). Browse prompts are turned into calls to
        these functions, which run locally on your data. When nothing fits, the model writes a new function from the
        schema and sample rows, tests it on a sample and saves it here for reuse.
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={lib.query}
          onChange={(e) => lib.setQuery(e.target.value)}
          placeholder="Search functions…"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <ChoiceChip active={!lib.category} onClick={() => lib.setCategory(null)}>All</ChoiceChip>
        {lib.categories.map((c) => (
          <ChoiceChip key={c} active={lib.category === c} onClick={() => lib.setCategory(c)}>
            {c}
          </ChoiceChip>
        ))}
      </div>
      <div className="space-y-2">
        {lib.visible.map((fn) => (
          <FunctionCard key={fn.name} fn={fn} onDelete={lib.remove} />
        ))}
        {!lib.visible.length && <p className="text-sm text-muted-foreground">No functions match.</p>}
      </div>
    </div>
  )
}
