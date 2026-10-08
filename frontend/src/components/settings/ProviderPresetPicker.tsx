import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChoiceChip } from "@/components/common/ChoiceChip"
import type { ProviderPreset } from "@/types/ai"

interface ProviderPresetPickerProps {
  presets: ProviderPreset[]
  onPick: (preset: ProviderPreset | null) => void
}

function Group({ title, presets, onPick }: { title: string; presets: ProviderPreset[]; onPick: (p: ProviderPreset) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <ChoiceChip key={p.id} onClick={() => onPick(p)}>{p.name}</ChoiceChip>
        ))}
      </div>
    </div>
  )
}

export function ProviderPresetPicker({ presets, onPick }: ProviderPresetPickerProps) {
  const [open, setOpen] = useState(false)
  const pick = (preset: ProviderPreset | null) => {
    onPick(preset)
    setOpen(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add provider
      </Button>
    )
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border-2 border-dashed border-primary/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black">Add a provider</p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Group title="Local servers" presets={presets.filter((p) => p.local)} onPick={pick} />
      <Group title="Cloud providers" presets={presets.filter((p) => !p.local)} onPick={pick} />
      <ChoiceChip onClick={() => pick(null)}>Other OpenAI-compatible endpoint…</ChoiceChip>
    </div>
  )
}
