import { ExternalLink, Info, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import type { AIProvider, ProviderPreset } from "@/types/ai"
import { ConnectionTest } from "./ConnectionTest"

interface ProviderFormProps {
  provider: AIProvider
  preset?: ProviderPreset
  onChange: (changes: Partial<AIProvider>) => void
  onRemove?: () => void
}

function keyPlaceholder(provider: AIProvider, preset?: ProviderPreset) {
  if (provider.api_key_hint) return `Saved key ${provider.api_key_hint}, type to replace`
  if (provider.has_api_key) return `Using ${preset?.env_key || "key"} from the environment`
  if (preset?.local) return "Not needed for local servers"
  return preset?.env_key ? `Paste key, or set ${preset.env_key}` : "Optional"
}

export function ProviderForm({ provider, preset, onChange, onRemove }: ProviderFormProps) {
  return (
    <div className="space-y-4 rounded-2xl border-2 border-border p-4">
      {preset?.note && (
        <p className="flex items-start gap-2 rounded-xl bg-muted p-2 text-xs font-semibold">
          <Info className="h-4 w-4 shrink-0 text-primary" /> {preset.note}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display name">
          <Input value={provider.name} onChange={(e) => onChange({ name: e.target.value })} />
        </FormField>
        <FormField label="Base URL" hint="OpenAI-compatible root (the part before /chat/completions)">
          <Input value={provider.base_url} onChange={(e) => onChange({ base_url: e.target.value })} />
        </FormField>
      </div>
      <FormField label="API key" hint="Stored locally in backend/.data_expert (git-ignored); never sent back to the browser.">
        <div className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            value={provider.api_key ?? ""}
            placeholder={keyPlaceholder(provider, preset)}
            onChange={(e) => onChange({ api_key: e.target.value || undefined })}
          />
          {provider.api_key_hint && (
            <Button variant="outline" size="sm" className="h-11" onClick={() => onChange({ api_key: "", api_key_hint: "" })}>
              Clear
            </Button>
          )}
        </div>
      </FormField>
      {preset?.key_url && (
        <a href={preset.key_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
          Get a {preset.name} API key <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ConnectionTest provider={provider} />
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4" /> Remove provider
          </Button>
        )}
      </div>
    </div>
  )
}
