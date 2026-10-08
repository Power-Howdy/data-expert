import { ChoiceChip } from "@/components/common/ChoiceChip"
import { CodeEditor } from "@/components/common/CodeEditor"
import type { ColumnSchema } from "@/types"
import { FieldEditor } from "./FieldEditor"
import type { RecordEditorState } from "./useRecordEditor"

interface RecordEditorProps {
  editor: RecordEditorState
  schema: ColumnSchema[]
}

export function RecordEditor({ editor, schema }: RecordEditorProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <ChoiceChip active={editor.mode === "fields"} onClick={() => editor.switchMode("fields")}>Fields</ChoiceChip>
        <ChoiceChip active={editor.mode === "json"} onClick={() => editor.switchMode("json")}>JSON</ChoiceChip>
      </div>
      {editor.mode === "json" ? (
        <div className="space-y-1">
          <CodeEditor
            language="json"
            value={editor.jsonText}
            onChange={editor.setJsonText}
            minHeight="20rem"
            maxHeight="70vh"
            invalid={!!editor.errors._json}
            autoFocus
          />
          {editor.errors._json && <p className="text-xs font-bold text-destructive">{editor.errors._json}</p>}
        </div>
      ) : (
        schema.map((col) => (
          <FieldEditor
            key={col.name}
            name={col.name}
            type={col.type}
            value={editor.draft[col.name] ?? null}
            onChange={(value) => editor.setField(col.name, value)}
            error={editor.errors[col.name]}
            changed={editor.changed(col.name)}
          />
        ))
      )}
    </div>
  )
}
