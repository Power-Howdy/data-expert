import type { ColumnSchema } from "./index"

export type ProviderKind = "openai" | "openrouter" | "ollama" | "lmstudio" | "custom"

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
  max_ai_rows: number
  batch_size: number
  concurrency: number
}

export interface AIPrompts {
  system: string
  planner: string
  row_task: string
  insights: string
}

export interface AISettings {
  active_provider_id: string
  providers: AIProvider[]
  model: AIModelSettings
  prompts: AIPrompts
  default_prompts: AIPrompts
  configured: boolean
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
  ai_rows: number
  warnings: string[]
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

export interface AIInsights {
  dataset_id: string
  markdown: string
  focus: string
  model: string
  generated_at: string
}

export type SaveFormat = "parquet" | "jsonl" | "csv" | "json"
