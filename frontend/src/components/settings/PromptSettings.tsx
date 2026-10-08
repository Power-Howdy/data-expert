import type { AIPrompts } from "@/types/ai"
import type { SettingsDraft } from "./useSettingsDraft"
import { PromptField } from "./PromptField"

const PROMPTS: Array<{ key: keyof AIPrompts; label: string; hint: string; rows: number }> = [
  { key: "system", label: "System prompt", hint: "Prepended to every request.", rows: 3 },
  {
    key: "planner", label: "Transform planner",
    hint: "Guides how Browse prompts become data operations. The list of allowed operations is added automatically.",
    rows: 8,
  },
  { key: "row_task", label: "Row enrichment", hint: "Used for AI columns (tagging, extraction, filling gaps) on each row.", rows: 4 },
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
