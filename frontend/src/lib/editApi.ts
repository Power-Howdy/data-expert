import { api } from "@/lib/api"
import type { RowData } from "@/types"

const http = api.client
const LONG = { timeout: 0 }

export type ReplaceMode = "exact" | "contains" | "regex"

export interface ReplaceBody {
  column: string
  old_value: unknown
  new_value: unknown
  mode: ReplaceMode
  case_sensitive: boolean
}

export interface ChangesSummary {
  total: number
  added: number
  updated: number
  deleted: number
  replaced: number
  transformed: number
  items: Array<{ type: string; label: string }>
}

export interface TransformStep {
  op: string
  params: Record<string, unknown>
}

/** Row editing. Every change is pending (applied on the fly) until commit() writes it to the file. */
export const editApi = {
  async getRow(datasetId: string, rowId: string): Promise<RowData> {
    return (await http.get(`/datasets/${datasetId}/rows/${rowId}`, LONG)).data
  },
  async addRow(datasetId: string, data: Record<string, unknown>): Promise<RowData> {
    return (await http.post(`/datasets/${datasetId}/rows`, { data }, LONG)).data
  },
  async updateRow(datasetId: string, rowId: string, data: Record<string, unknown>): Promise<RowData> {
    return (await http.put(`/datasets/${datasetId}/rows/${rowId}`, { data }, LONG)).data
  },
  async deleteRow(datasetId: string, rowId: string): Promise<void> {
    await http.delete(`/datasets/${datasetId}/rows/${rowId}`, LONG)
  },
  async previewReplace(datasetId: string, body: ReplaceBody): Promise<number> {
    const config = { ...LONG, silent: true } as object
    return (await http.post(`/datasets/${datasetId}/replace/preview`, body, config)).data.data.count
  },
  async replace(datasetId: string, body: ReplaceBody): Promise<number> {
    return (await http.post(`/datasets/${datasetId}/replace`, body, LONG)).data.data.count
  },
  async transform(datasetId: string, operations: TransformStep[], description = ""): Promise<void> {
    await http.post(`/datasets/${datasetId}/transform`, { operations, description }, LONG)
  },
  async getChanges(datasetId: string): Promise<ChangesSummary> {
    return (await http.get(`/datasets/${datasetId}/changes`, { silent: true } as object)).data
  },
  async undo(datasetId: string): Promise<ChangesSummary> {
    return (await http.post(`/datasets/${datasetId}/changes/undo`)).data
  },
  async commit(datasetId: string): Promise<void> {
    await http.post(`/datasets/${datasetId}/commit`, null, LONG)
  },
  async discard(datasetId: string): Promise<void> {
    await http.post(`/datasets/${datasetId}/discard`)
  },
}
