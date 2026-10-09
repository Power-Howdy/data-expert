import type { FunctionParam, FunctionSpec, PlanStep } from "@/types/ai"

/** What the form holds for each parameter: text for most types, a flag or a column list for the rest. */
export type DraftValue = string | boolean | string[]
export type Draft = Record<string, DraftValue>

const LIST_TYPES = ["list"]
const MAPPING_TYPES = ["mapping"]

export function draftDefaults(spec: FunctionSpec): Draft {
  const draft: Draft = {}
  for (const p of spec.params) {
    if (p.type === "boolean") draft[p.name] = p.default === true
    else if (p.type === "columns") draft[p.name] = Array.isArray(p.default) ? p.default.map(String) : []
    else if (p.default !== undefined && p.default !== null) draft[p.name] = toText(p.default, p.type)
    else draft[p.name] = ""
  }
  return draft
}

function toText(value: unknown, type: string): string {
  if (LIST_TYPES.includes(type) && Array.isArray(value)) return value.join("\n")
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

/** A text value as the most natural JSON value: numbers and true/false become typed, the rest stays text. */
function scalar(text: string): unknown {
  const t = text.trim()
  if (t === "true" || t === "false") return t === "true"
  return t !== "" && !Number.isNaN(Number(t)) ? Number(t) : t
}

function parseList(text: string): unknown[] {
  if (text.trim().startsWith("[")) return JSON.parse(text)
  return text.split(/\n|,/).map((s) => s.trim()).filter(Boolean).map(scalar)
}

/** `key = value` lines (a value with commas becomes a list), or a JSON object. */
function parseMapping(text: string): Record<string, unknown> {
  if (text.trim().startsWith("{")) return JSON.parse(text)
  const entries = text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const at = line.indexOf("=")
    if (at < 1) throw new Error(`"${line}" needs the form key = value`)
    const value = line.slice(at + 1).trim()
    return [line.slice(0, at).trim(), value.includes(",") ? parseList(value) : scalar(value)]
  })
  return Object.fromEntries(entries)
}

function parseValue(p: FunctionParam, value: DraftValue): unknown {
  if (typeof value !== "string") return value
  if (p.type === "number" || p.type === "integer") {
    const n = Number(value)
    if (Number.isNaN(n)) throw new Error(`${p.name} must be a number`)
    return p.type === "integer" ? Math.trunc(n) : n
  }
  if (LIST_TYPES.includes(p.type)) return parseList(value)
  if (MAPPING_TYPES.includes(p.type)) return parseMapping(value)
  return value
}

const isEmpty = (v: DraftValue | undefined) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0)

/** Typed step parameters from the form; throws a readable Error when something is missing or malformed. */
export function toParams(spec: FunctionSpec, draft: Draft): Record<string, unknown> {
  const missing = spec.params.filter((p) => p.required && isEmpty(draft[p.name])).map((p) => p.name)
  if (missing.length) throw new Error(`Fill in ${missing.join(", ")}`)
  const params: Record<string, unknown> = {}
  for (const p of spec.params) {
    const value = draft[p.name]
    if (isEmpty(value) || (p.type === "boolean" && value === p.default)) continue
    try {
      params[p.name] = parseValue(p, value)
    } catch (e) {
      throw new Error(e instanceof SyntaxError ? `${p.name} is not valid JSON` : (e as Error).message)
    }
  }
  return params
}

export function stepSummary(step: PlanStep): string {
  return Object.entries(step.params)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ")
}

export function paramHint(p: FunctionParam): string {
  const format = LIST_TYPES.includes(p.type)
    ? "One per line or comma-separated"
    : MAPPING_TYPES.includes(p.type) ? "One key = value per line (commas make a list), or JSON" : ""
  return [p.description, format].filter(Boolean).join(". ")
}
