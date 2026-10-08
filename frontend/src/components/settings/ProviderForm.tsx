import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import type { AIProvider } from "@/types/ai"
import { ConnectionTest } from "./ConnectionTest"

interface ProviderFormProps {
  provider: AIProvider
  onChange: (changes: Partial<AIProvider>) => void
  onRemove?: () => void
}

const LOCAL = new Set(["ollama", "lmstudio"])

function keyPlaceholder(provider: AIProvider) {
  if (provider.api_key_hint) return `Saved key ${provider.api_key_hint}, type to replace`
  if (provider.has_api_key) return "Using key from environment variable"
  return LOCAL.has(provider.kind) ? "Not needed for local servers" : "sk-..."
}

export function ProviderForm({ provider, onChange, onRemove }: ProviderFormProps) {
  return (
    <div className="space-y-4 rounded-2xl border-2 border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Display name">
          <Input value={provider.name} onChange={(e) => onChange({ name: e.target.value })} />
        </FormField>
        <FormField label="Base URL" hint="Must point at the /v1 root">
          <Input value={provider.base_url} onChange={(e) => onChange({ base_url: e.target.value })} />
        </FormField>
      </div>
      <FormField label="API key" hint="Stored locally in backend/.data_expert (git-ignored); never sent back to the browser.">
        <div className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            value={provider.api_key ?? ""}
            placeholder={keyPlaceholder(provider)}
            onChange={(e) => onChange({ api_key: e.target.value || undefined })}
          />
          {provider.api_key_hint && (
            <Button variant="outline" size="sm" className="h-11" onClick={() => onChange({ api_key: "", api_key_hint: "" })}>
              Clear
            </Button>
          )}
        </div>
      </FormField>
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
