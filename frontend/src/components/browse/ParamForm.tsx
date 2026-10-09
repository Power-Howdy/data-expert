import { FormField } from "@/components/common/FormField"
import type { FunctionSpec } from "@/types/ai"
import { ParamInput } from "./ParamInput"
import { paramHint, type Draft, type DraftValue } from "./toolParams"

interface ParamFormProps {
  spec: FunctionSpec
  draft: Draft
  columns: string[]
  onChange: (name: string, value: DraftValue) => void
}

/** One input per parameter of a tool; optional ones are marked. */
export function ParamForm({ spec, draft, columns, onChange }: ParamFormProps) {
  if (!spec.params.length) return <p className="text-xs font-semibold text-muted-foreground">This tool has no settings.</p>
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {spec.params.map((p) => {
        const input = (
          <ParamInput param={p} value={draft[p.name] ?? ""} columns={columns} onChange={(v) => onChange(p.name, v)} />
        )
        if (p.type === "boolean") return <div key={p.name} className="flex items-end pb-1">{input}</div>
        const wide = p.type === "columns" || p.type === "mapping" || p.type === "list"
        return (
          <div key={p.name} className={wide ? "md:col-span-2" : undefined}>
            <FormField label={`${p.name.replace(/_/g, " ")}${p.required ? "" : " (optional)"}`} hint={paramHint(p)}>
              {input}
            </FormField>
          </div>
        )
      })}
    </div>
  )
}
