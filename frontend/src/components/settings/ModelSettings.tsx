import { Checkbox } from "@/components/ui/checkbox"
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
        <label className="flex items-start gap-3 text-sm font-semibold">
          <Checkbox checked={m.json_mode} onCheckedChange={(v) => set({ json_mode: v === true })} className="mt-0.5" />
          <span>
            Request JSON mode
            <span className="block text-xs text-muted-foreground">
              Sends response_format=json_object. Enable for OpenAI; leave off if your local server rejects it.
            </span>
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <SubHeading>Row processing (AI columns)</SubHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Max rows per step" value={m.max_ai_rows} min={1}
            hint="Caps cost; other rows stay empty" onChange={(v) => set({ max_ai_rows: v })}
          />
          <NumberField
            label="Rows per request" value={m.batch_size} min={1} max={200}
            hint="Lower for small local models" onChange={(v) => set({ batch_size: v })}
          />
          <NumberField
            label="Parallel requests" value={m.concurrency} min={1} max={32}
            onChange={(v) => set({ concurrency: v })}
          />
        </div>
      </section>
    </div>
  )
}
