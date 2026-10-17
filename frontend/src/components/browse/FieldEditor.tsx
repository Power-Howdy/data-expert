import { useState } from "react"
import { Input } from "@/components/ui/input"
import { CodeEditor } from "@/components/common/CodeEditor"
import { SimpleSelect, toOptions } from "@/components/common/SimpleSelect"
import type { DataType } from "@/types"
import { emptyDraft, isLongText, isNested, type FieldDraft } from "./fieldValue"

interface FieldEditorProps {
  name: string
  type: DataType
  value: FieldDraft
  onChange: (value: FieldDraft) => void
  error?: string
  changed?: boolean
}

const PLACEHOLDERS: Partial<Record<DataType, string>> = {
  date: "YYYY-MM-DD", datetime: "YYYY-MM-DD HH:MM:SS", time: "HH:MM:SS",
}

function Control({ type, value, onChange, multiline }: { type: DataType; value: string; onChange: (v: string) => void; multiline: boolean }) {
  if (type === "boolean") {
    return <SimpleSelect value={value || "false"} onChange={onChange} options={toOptions(["true", "false"])} />
  }
  if (isNested(type)) return <CodeEditor language="json" value={value} onChange={onChange} minHeight="4rem" />
  if (multiline) return <CodeEditor value={value} onChange={onChange} minHeight="4rem" />
  const numeric = type === "integer" || type === "float"
  return (
    <Input
      value={value}
      inputMode={numeric ? "decimal" : undefined}
      placeholder={PLACEHOLDERS[type]}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function FieldEditor({ name, type, value, onChange, error, changed }: FieldEditorProps) {
  const [multiline, setMultiline] = useState(() => isLongText(value))
  const isNull = value === null
  const textual = type === "string" && !isNull

  return (
    <div className={`rounded-xl border-2 bg-background/60 ${changed ? "border-primary/60" : "border-border"}`}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="text-sm font-extrabold">{name}</span>
        <span className="text-[10px] font-semibold lowercase text-muted-foreground/70">{type}</span>
        {changed && <span className="text-[10px] font-black uppercase text-primary">edited</span>}
        <div className="ml-auto flex items-center gap-3 text-xs font-bold text-muted-foreground">
          {textual && (
            <button type="button" className="hover:text-foreground" onClick={() => setMultiline(!multiline)}>
              {multiline ? "Single line" : "Multi-line"}
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-1">
            <input type="checkbox" checked={isNull} onChange={(e) => onChange(e.target.checked ? null : emptyDraft(type))} />
            NULL
          </label>
        </div>
      </div>
      <div className="px-3 py-2">
        {isNull ? (
          <span className="text-sm font-semibold text-muted-foreground">NULL</span>
        ) : (
          <Control type={type} value={value} onChange={onChange} multiline={multiline} />
        )}
        {error && <p className="mt-1 text-xs font-bold text-destructive">{error}</p>}
      </div>
    </div>
  )
}
