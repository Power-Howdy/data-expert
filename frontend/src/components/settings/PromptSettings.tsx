import type { AIPrompts } from "@/types/ai"
import type { SettingsDraft } from "./useSettingsDraft"
import { PromptField } from "./PromptField"

const PROMPTS: Array<{ key: keyof AIPrompts; label: string; hint: string; rows: number }> = [
  { key: "system", label: "System prompt", hint: "Prepended to every request.", rows: 3 },
  {
    key: "planner", label: "Transform planner",
    hint: "Guides how Browse prompts become function calls. The function library and reply format are added automatically.",
    rows: 8,
  },
  {
    key: "function_writer", label: "Function writer",
    hint: "Used when no library function fits and the model writes a new one. Code rules are added automatically.",
    rows: 4,
  },
  { key: "insights", label: "Insights report", hint: "Used on the Stats tab together with the dataset profile.", rows: 5 },
]

export function PromptSettings({ draft }: { draft: SettingsDraft }) {
  const settings = draft.draft
  if (!settings) return null
  return (
    <div className="space-y-5">
      {PROMPTS.map(({ key, label, hint, rows }) => (
        <PromptField
          key={key}
          label={label}
          hint={hint}
          rows={rows}
          value={settings.prompts[key]}
          defaultValue={settings.default_prompts[key]}
          onChange={(value) => draft.updatePrompt(key, value)}
        />
      ))}
    </div>
  )
}
