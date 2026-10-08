import * as React from "react"

interface FormFieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

export function FormField({ label, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs font-semibold text-muted-foreground">{hint}</p>}
    </div>
  )
}
