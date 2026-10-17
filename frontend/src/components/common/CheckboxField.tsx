import { Checkbox } from "@/components/ui/checkbox"

interface CheckboxFieldProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function CheckboxField({ label, hint, checked, onChange }: CheckboxFieldProps) {
  return (
    <label className="flex items-start gap-3 text-sm font-semibold">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}
