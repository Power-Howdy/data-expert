import * as React from "react"
import { Sparkles } from "lucide-react"
import { ChoiceChip } from "@/components/common/ChoiceChip"
import { SimpleSelect } from "@/components/common/SimpleSelect"
import type { FunctionSpec } from "@/types/ai"

interface ToolPickerProps {
  functions: FunctionSpec[]
  selected: FunctionSpec | null
  onSelect: (name: string) => void
}

/** Choose a tool from the function library, narrowed by category. */
export function ToolPicker({ functions, selected, onSelect }: ToolPickerProps) {
  const [category, setCategory] = React.useState<string | null>(null)
  const categories = React.useMemo(() => [...new Set(functions.map((f) => f.category))].sort(), [functions])
  const shown = functions.filter((f) => !category || f.category === category)
  const pickCategory = (next: string | null) => {
    setCategory(next)
    if (selected && next && selected.category !== next) onSelect("")
  }
  const options = shown.map((f) => ({
    value: f.name,
    label: (
      <span className="flex items-center gap-1.5">
        {f.source === "generated" && <Sparkles className="h-3 w-3 text-amber-500" />}
        {f.title || f.name}
      </span>
    ),
  }))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <ChoiceChip active={!category} onClick={() => pickCategory(null)}>All</ChoiceChip>
        {categories.map((c) => (
          <ChoiceChip key={c} active={category === c} onClick={() => pickCategory(c)} className="capitalize">{c}</ChoiceChip>
        ))}
      </div>
      <SimpleSelect
        value={selected?.name ?? ""} onChange={onSelect} options={options}
        placeholder={`Choose a tool (${shown.length})`}
      />
      {selected && <p className="text-xs font-semibold text-muted-foreground">{selected.purpose}</p>}
    </div>
  )
}
