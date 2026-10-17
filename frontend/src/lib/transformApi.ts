import { api } from "@/lib/api"
import type { AIJob, FunctionSpec, PlanStep, StepsPreview } from "@/types/ai"

const http = api.client

interface StepsBody {
  steps: PlanStep[]
  viewId?: string
  description?: string
}

const body = (datasetId: string, { steps, viewId, description = "" }: StepsBody) => ({
  dataset_id: datasetId, steps, view_id: viewId, description,
})

/** Data tools without AI: the same function library and executor the AI uses, driven by the user's own steps. */
export const transformApi = {
  async listFunctions(): Promise<FunctionSpec[]> {
    return (await http.get("/functions")).data
  },
  async preview(datasetId: string, steps: StepsBody): Promise<StepsPreview> {
    return (await http.post("/transform/preview", body(datasetId, steps), { timeout: 0, silent: true } as object)).data
  },
  async run(datasetId: string, steps: StepsBody): Promise<AIJob> {
    return (await http.post("/transform/run", body(datasetId, steps))).data
  },
}
