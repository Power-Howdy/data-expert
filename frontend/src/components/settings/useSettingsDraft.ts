import * as React from "react"
import toast from "react-hot-toast"
import { aiApi } from "@/lib/aiApi"
import { useAIStore } from "@/stores/useAIStore"
import type { AIModelSettings, AIPrompts, AIProvider, AISettings } from "@/types/ai"

export function useSettingsDraft() {
  const { settings, setSettings, closeSettings } = useAIStore()
  const [draft, setDraft] = React.useState<AISettings | null>(settings)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => setDraft(settings), [settings])

  const patch = (fn: (d: AISettings) => Partial<AISettings>) =>
    setDraft((d) => (d ? { ...d, ...fn(d) } : d))

  const provider = draft?.providers.find((p) => p.id === draft.active_provider_id)

  const updateProvider = (changes: Partial<AIProvider>) =>
    patch((d) => ({
      providers: d.providers.map((p) => (p.id === d.active_provider_id ? { ...p, ...changes } : p)),
    }))

  const addProvider = () => {
    const id = `custom-${Date.now().toString(36)}`
    const custom: AIProvider = { id, name: "Custom endpoint", kind: "custom", base_url: "http://localhost:8080/v1", model: "" }
    patch((d) => ({ providers: [...d.providers, custom], active_provider_id: id }))
  }

  const removeProvider = (id: string) =>
    patch((d) => {
      const providers = d.providers.filter((p) => p.id !== id)
      return { providers, active_provider_id: providers[0]?.id ?? "" }
    })

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const { active_provider_id, providers, model, prompts } = draft
      setSettings(await aiApi.saveSettings({ active_provider_id, providers, model, prompts }))
      toast.success("AI settings saved")
      closeSettings()
    } catch {
      // error toast comes from the API client
    } finally {
      setSaving(false)
    }
  }

  return {
    draft, provider, saving, save, close: closeSettings,
    setActive: (id: string) => patch(() => ({ active_provider_id: id })),
    updateProvider, addProvider, removeProvider,
    updateModel: (changes: Partial<AIModelSettings>) => patch((d) => ({ model: { ...d.model, ...changes } })),
    updatePrompt: (key: keyof AIPrompts, value: string) => patch((d) => ({ prompts: { ...d.prompts, [key]: value } })),
  }
}

export type SettingsDraft = ReturnType<typeof useSettingsDraft>
