import { ChoiceChip } from "@/components/common/ChoiceChip"

export const SAMPLE_PROMPTS = [
  "Extract the email addresses from the text",
  "Extract the phone numbers from the text",
  "Filter data with more than 10 tokens",
  "Enrich data with a topic field using AI",
  "Get me the best 10 results from the data",
  "Fill in the missing data in the text",
  "Classify the sentiment of each row as positive, neutral or negative",
  "Remove duplicate rows",
]

interface SamplePromptsProps {
  onPick: (prompt: string) => void
  disabled?: boolean
  prompts?: string[]
}

export function SamplePrompts({ onPick, disabled, prompts = SAMPLE_PROMPTS }: SamplePromptsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((p) => (
        <ChoiceChip key={p} onClick={() => onPick(p)} disabled={disabled}>
          {p}
        </ChoiceChip>
      ))}
    </div>
  )
}
