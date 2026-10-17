import { Input } from "@/components/ui/input"
import { FormField } from "./FormField"

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  hint?: string
}

export function NumberField({ label, value, onChange, min, max, step = 1, hint }: NumberFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = e.target.valueAsNumber
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    </FormField>
  )
}
