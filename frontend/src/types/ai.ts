import type { ColumnSchema } from "./index"

/** Id of a provider preset, or "custom". */
export type ProviderKind = string

export interface ProviderPreset {
  id: string
  name: string
  base_url: string
  model: string
  local: boolean
  env_key: string
  auth: "bearer" | "anthropic" | "azure"
  key_url: string
  note: string
}

export interface AIProvider {
  id: string
  name: string
  kind: ProviderKind
  base_url: string
  model: string
  /** Only sent when the user typed a new key: undefined keeps, "" clears. */
  api_key?: string
  has_api_key?: boolean
  api_key_hint?: string
}

export interface AIModelSettings {
  temperature: number
  max_tokens: number
  timeout_seconds: number
  json_mode: boolean
  disable_thinking: boolean
  sample_rows: number
}

export interface AIPrompts {
  system: string
  planner: string
  function_writer: string
  insights: string
}

export interface AISettings {
  active_provider_id: string
  providers: AIProvider[]
  model: AIModelSettings
  prompts: AIPrompts
  default_prompts: AIPrompts
  configured: boolean
  presets: ProviderPreset[]
}

export interface ProviderTestResult {
  ok: boolean
  latency_ms: number
  reply: string
  error: string
}

export interface PlanStep {
  op: string
  description: string
  params: Record<string, any>
}

export interface TransformPlan {
  explanation: string
  steps: PlanStep[]
  new_functions: string[]
  warnings: string[]
}

export interface FunctionParam {
  name: string
  type: string
  required: boolean
  default?: unknown
  description: string
  options: string[]
}

export interface FunctionSpec {
  name: string
  title: string
  category: string
  purpose: string
  params: FunctionParam[]
  input: string
  output: string
  example: Record<string, unknown>
  source: "builtin" | "generated"
  code?: string | null
  prompt: string
  created_at?: string | null
  uses: number
}

export interface DataView {
  id: string
  dataset_id: string
  parent_view_id?: string | null
  prompt: string
  steps: PlanStep[]
  schema: ColumnSchema[]
  total: number
  notes: string[]
}

export interface AIJob {
  id: string
  status: "running" | "done" | "error" | "cancelled"
  done: number
  total: number
  message: string
  error: string
  view?: DataView | null
}

/** Steps run on the first rows of the data. */
export interface StepsPreview {
  columns: ColumnSchema[]
  rows: Record<string, unknown>[]
  sample_rows: number
  result_rows: number
}

export interface AIInsights {
  dataset_id: string
  markdown: string
  focus: string
  model: string
  generated_at: string
}

export type SaveFormat = "parquet" | "jsonl" | "csv" | "json"
