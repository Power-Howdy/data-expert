import { api } from "@/lib/api"
import type { Dataset, RowsResponse } from "@/types"
import type {
  AIInsights, AIJob, AIProvider, AISettings, FunctionSpec, ProviderTestResult, SaveFormat, TransformPlan,
} from "@/types/ai"

const http = api.client
const LONG = { timeout: 0 }

type SettingsUpdate = Pick<AISettings, "active_provider_id" | "providers" | "model" | "prompts">

export const aiApi = {
  async getSettings(): Promise<AISettings> {
    return (await http.get("/ai/settings")).data
  },
  async saveSettings(update: SettingsUpdate): Promise<AISettings> {
    return (await http.put("/ai/settings", update)).data
  },
  async listModels(provider: AIProvider): Promise<string[]> {
    return (await http.post("/ai/models", { provider })).data.models
  },
  async testProvider(provider: AIProvider): Promise<ProviderTestResult> {
    return (await http.post("/ai/test", { provider }, LONG)).data
  },

  async listFunctions(): Promise<FunctionSpec[]> {
    return (await http.get("/ai/functions")).data
  },
  async deleteFunction(name: string): Promise<void> {
    await http.delete(`/ai/functions/${name}`)
  },

  async plan(datasetId: string, prompt: string, viewId?: string): Promise<TransformPlan> {
    return (await http.post("/ai/plan", { dataset_id: datasetId, prompt, view_id: viewId }, LONG)).data
  },
  async apply(datasetId: string, plan: TransformPlan, prompt: string, viewId?: string): Promise<AIJob> {
    return (await http.post("/ai/apply", { dataset_id: datasetId, plan, prompt, view_id: viewId })).data
  },
  async getJob(jobId: string): Promise<AIJob> {
    return (await http.get(`/ai/jobs/${jobId}`)).data
  },
  async cancelJob(jobId: string): Promise<void> {
    await http.post(`/ai/jobs/${jobId}/cancel`)
  },

  async getViewRows(viewId: string, offset: number, limit: number, filters?: unknown[]): Promise<RowsResponse> {
    const params: Record<string, string> = { offset: String(offset), limit: String(limit) }
    if (filters?.length) params.filters = JSON.stringify(filters)
    return (await http.get(`/views/${viewId}/rows`, { params })).data
  },
  async deleteView(viewId: string): Promise<void> {
    await http.delete(`/views/${viewId}`, { silent: true } as object)
  },
  async saveAs(
    datasetId: string,
    body: { name: string; format: SaveFormat; view_id?: string; filters?: unknown[]; overwrite?: boolean },
  ): Promise<Dataset> {
    return (await http.post(`/datasets/${datasetId}/save-as`, body, { ...LONG, silent: true } as object)).data
  },

  async getSavedInsights(datasetId: string): Promise<AIInsights | null> {
    return (await http.get(`/datasets/${datasetId}/ai/insights`, { silent: true } as object)).data
  },
  async generateInsights(datasetId: string, focus: string): Promise<AIInsights> {
    return (await http.post(`/datasets/${datasetId}/ai/insights`, { focus }, LONG)).data
  },
}
