import { ChoiceChip } from "@/components/common/ChoiceChip"
import type { SettingsDraft } from "./useSettingsDraft"
import { ProviderForm } from "./ProviderForm"
import { ProviderPresetPicker } from "./ProviderPresetPicker"

export function ProviderSettings({ draft }: { draft: SettingsDraft }) {
  const { draft: settings, provider } = draft
  if (!settings) return null
  const preset = settings.presets.find((p) => p.id === provider?.kind)

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
          <ProviderPresetPicker presets={settings.presets} onPick={draft.addProvider} />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {settings.presets.length} presets, plus any other OpenAI-compatible endpoint.
        </p>
      </div>
      {provider && (
        <ProviderForm
          provider={provider}
          preset={preset}
          onChange={draft.updateProvider}
          onRemove={settings.providers.length > 1 ? () => draft.removeProvider(provider.id) : undefined}
        />
      )}
    </div>
  )
}
