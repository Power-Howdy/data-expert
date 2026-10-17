import { ChoiceChip } from "./ChoiceChip"

interface MultiChoiceProps {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

/** Pick any number of options as toggle chips; the selection keeps the order of `options`. */
export function MultiChoice({ options, value, onChange, disabled }: MultiChoiceProps) {
  const toggle = (option: string) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : options.filter((o) => o === option || value.includes(o)))
  return (
    <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
      {options.map((option) => (
        <ChoiceChip key={option} active={value.includes(option)} onClick={() => toggle(option)} disabled={disabled}>
          {option}
        </ChoiceChip>
      ))}
    </div>
  )
}
