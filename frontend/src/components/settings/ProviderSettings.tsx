import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChoiceChip } from "@/components/common/ChoiceChip"
import type { SettingsDraft } from "./useSettingsDraft"
import { ProviderForm } from "./ProviderForm"

export function ProviderSettings({ draft }: { draft: SettingsDraft }) {
  const { draft: settings, provider } = draft
  if (!settings) return null

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Active provider</p>
        <div className="flex flex-wrap gap-2">
          {settings.providers.map((p) => (
            <ChoiceChip key={p.id} active={p.id === settings.active_provider_id} onClick={() => draft.setActive(p.id)}>
              {p.name}
            </ChoiceChip>
          ))}
          <Button variant="outline" size="sm" onClick={draft.addProvider}>
            <Plus className="h-4 w-4" /> Custom
          </Button>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          Any OpenAI-compatible endpoint works: OpenAI, OpenRouter, Ollama, LM Studio, vLLM, llama.cpp server.
        </p>
      </div>
      {provider && (
        <ProviderForm
          provider={provider}
          onChange={draft.updateProvider}
          onRemove={provider.kind === "custom" ? () => draft.removeProvider(provider.id) : undefined}
        />
      )}
    </div>
  )
}
