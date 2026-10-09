import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckboxField } from "@/components/common/CheckboxField"
import { MultiChoice } from "@/components/common/MultiChoice"
import { SimpleSelect, toOptions } from "@/components/common/SimpleSelect"
import type { FunctionParam } from "@/types/ai"
import type { DraftValue } from "./toolParams"

interface ParamInputProps {
  param: FunctionParam
  value: DraftValue
  columns: string[]
  onChange: (value: DraftValue) => void
}

const PLACEHOLDERS: Record<string, string> = {
  new_column: "Name of the new column",
  regex: "Regular expression",
  list: "apple\nbanana",
  mapping: "old = new",
}

/** The input that suits a parameter's type: column pickers, number boxes, choices, flags or free text. */
export function ParamInput({ param, value, columns, onChange }: ParamInputProps) {
  const text = typeof value === "string" ? value : ""
  switch (param.type) {
    case "column":
      return <SimpleSelect value={text} onChange={onChange} options={toOptions(columns)} placeholder="Choose a column" />
    case "columns":
      return <MultiChoice options={columns} value={Array.isArray(value) ? value : []} onChange={onChange} />
    case "enum":
      return <SimpleSelect value={text} onChange={onChange} options={toOptions(param.options)} placeholder="Choose" />
    case "boolean":
      return <CheckboxField label={param.description || param.name} checked={value === true} onChange={onChange} />
    case "number":
    case "integer":
      return <Input type="number" step={param.type === "integer" ? 1 : "any"} value={text} onChange={(e) => onChange(e.target.value)} />
    case "list":
    case "mapping":
      return (
        <Textarea
          rows={3} className="font-mono text-xs" value={text} placeholder={PLACEHOLDERS[param.type]}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default:
      return <Input value={text} placeholder={PLACEHOLDERS[param.type]} onChange={(e) => onChange(e.target.value)} />
  }
}
