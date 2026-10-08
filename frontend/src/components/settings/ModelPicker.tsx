import * as React from "react"
import { RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/common/LoadingButton"
import { FormField } from "@/components/common/FormField"
import { aiApi } from "@/lib/aiApi"
import type { AIProvider } from "@/types/ai"

interface ModelPickerProps {
  provider: AIProvider
  onChange: (model: string) => void
}

export function ModelPicker({ provider, onChange }: ModelPickerProps) {
  const [models, setModels] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const listId = `models-${provider.id}`

  React.useEffect(() => setModels([]), [provider.id, provider.base_url])

  const fetchModels = async () => {
    setLoading(true)
    try {
      setModels(await aiApi.listModels(provider))
    } catch {
      setModels([])
    } finally {
      setLoading(false)
    }
  }

  const hint = models.length
    ? `${models.length} models available from ${provider.name}; type to filter`
    : `Model used with ${provider.name}. Load the list or type a model id.`

  return (
    <FormField label="Model" hint={hint}>
      <div className="flex gap-2">
        <Input
          list={listId}
          value={provider.model}
          placeholder="e.g. gpt-4o-mini, llama3.1, qwen2.5:7b"
          onChange={(e) => onChange(e.target.value)}
        />
        <datalist id={listId}>
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
        <LoadingButton variant="outline" className="shrink-0" onClick={fetchModels} loading={loading}>
          {!loading && <RefreshCw className="h-4 w-4" />} Load models
        </LoadingButton>
      </div>
    </FormField>
  )
}
