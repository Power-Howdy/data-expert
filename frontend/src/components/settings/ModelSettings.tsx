import { CheckboxField } from "@/components/common/CheckboxField"
import { NumberField } from "@/components/common/NumberField"
import type { SettingsDraft } from "./useSettingsDraft"
import { ModelPicker } from "./ModelPicker"

function SubHeading({ children }: { children: string }) {
  return <h4 className="text-sm font-black text-foreground">{children}</h4>
}

export function ModelSettings({ draft }: { draft: SettingsDraft }) {
  const { draft: settings, provider } = draft
  if (!settings) return null
  const m = settings.model
  const set = draft.updateModel

  return (
    <div className="space-y-6">
      {provider && <ModelPicker provider={provider} onChange={(model) => draft.updateProvider({ model })} />}

      <section className="space-y-3">
        <SubHeading>Generation</SubHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Temperature" value={m.temperature} min={0} max={2} step={0.1} onChange={(v) => set({ temperature: v })} />
          <NumberField label="Max tokens" value={m.max_tokens} min={16} step={256} onChange={(v) => set({ max_tokens: v })} />
          <NumberField label="Timeout (s)" value={m.timeout_seconds} min={5} onChange={(v) => set({ timeout_seconds: v })} />
        </div>
        <CheckboxField
          label="Request JSON mode" checked={m.json_mode} onChange={(v) => set({ json_mode: v })}
          hint="Sends response_format=json_object. Enable for OpenAI; leave off if your local server rejects it."
        />
        <CheckboxField
          label="Disable thinking (local models)" checked={m.disable_thinking}
          onChange={(v) => set({ disable_thinking: v })}
          hint="Turns off reasoning for Qwen3/DeepSeek-style models on llama.cpp, vLLM and similar servers. Much faster."
        />
      </section>

      <section className="space-y-3">
        <SubHeading>Data privacy</SubHeading>
        <p className="text-xs text-muted-foreground">
          Your data is processed locally by library functions. The model only receives the schema, column
          statistics and this many sample rows (long values truncated) to choose or write functions.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Sample rows sent" value={m.sample_rows} min={0} max={50}
            hint="0 = schema only" onChange={(v) => set({ sample_rows: v })}
          />
        </div>
      </section>
    </div>
  )
}
