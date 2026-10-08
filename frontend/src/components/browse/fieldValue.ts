import type { ColumnSchema, DataType } from "@/types"

/** Draft of one field: text as typed by the user, or null for NULL. */
export type FieldDraft = string | null
export type RecordDraft = Record<string, FieldDraft>

const NESTED: DataType[] = ["list", "struct", "unknown", "binary"]
const LONG_TEXT = 80

export function isNested(type: DataType) {
  return NESTED.includes(type)
}

export function isLongText(value: FieldDraft) {
  return !!value && (value.length > LONG_TEXT || value.includes("\n"))
}

/** Starting text when a NULL field is given a value. */
export function emptyDraft(type: DataType): string {
  if (type === "list") return "[]"
  if (type === "struct") return "{}"
  if (type === "boolean") return "false"
  return ""
}

export function toDraft(value: unknown, type: DataType): FieldDraft {
  if (value === null || value === undefined) return null
  if (isNested(type) || typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

export function fromDraft(draft: FieldDraft, type: DataType): unknown {
  if (draft === null) return null
  if (isNested(type)) {
    try {
      return JSON.parse(draft)
    } catch {
      throw new Error("Invalid JSON")
    }
  }
  if (type === "integer" || type === "float") {
    if (draft.trim() === "") return null
    const n = Number(draft)
    if (Number.isNaN(n) || (type === "integer" && !Number.isInteger(n))) throw new Error(`Not a valid ${type}`)
    return n
  }
  if (type === "boolean") return draft === "true"
  return draft
}

export function draftFromRecord(data: Record<string, unknown> | null, schema: ColumnSchema[]): RecordDraft {
  return Object.fromEntries(schema.map((c) => [c.name, data ? toDraft(data[c.name], c.type) : null]))
}

/** Parse every field; returns the values or a map of per-field errors. */
export function parseDraft(draft: RecordDraft, schema: ColumnSchema[]) {
  const values: Record<string, unknown> = {}
  const errors: Record<string, string> = {}
  for (const col of schema) {
    try {
      values[col.name] = fromDraft(draft[col.name] ?? null, col.type)
    } catch (e) {
      errors[col.name] = (e as Error).message
    }
  }
  return { values, errors }
}
