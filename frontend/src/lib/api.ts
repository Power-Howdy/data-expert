import axios, { AxiosInstance, AxiosError } from "axios"
import toast from "react-hot-toast"

const API_BASE = import.meta.env.VITE_API_URL || "/api"

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const message = error.response?.data as any
        const detail = message?.detail || message?.error || error.message
        const silent = (error.config as { silent?: boolean } | undefined)?.silent
        if (!silent && detail !== "No folder selected") {
          toast.error(detail)
        }
        return Promise.reject(error)
      }
    )
  }

  // Directory & Dataset
  async pickDirectory(): Promise<{ path: string }> {
    const { data } = await this.client.post("/directories/pick", null, { timeout: 0 })
    return data
  }

  async getDirectoryTree(path: string, maxDepth = 3) {
    const { data } = await this.client.get("/directories/tree", {
      params: { path, max_depth: maxDepth },
    })
    return data
  }

  async scanDirectory(path: string, recursive = true, maxDepth?: number) {
    const { data } = await this.client.post("/directories/scan", {
      path,
      recursive,
      max_depth: maxDepth,
    })
    return data
  }

  async listDatasets(silent = false) {
    const { data } = await this.client.get("/datasets", { silent } as object)
    return data
  }

  async getDataset(id: string) {
    const { data } = await this.client.get(`/datasets/${id}`)
    return data
  }

  async loadDataset(path: string, name?: string, format?: string, options?: any) {
    const { data } = await this.client.post("/datasets/load", {
      path,
      name,
      format,
      options,
    })
    return data
  }

  async unloadDataset(id: string) {
    const { data } = await this.client.delete(`/datasets/${id}`)
    return data
  }

  // Data Browsing
  async getRows(
    id: string,
    offset = 0,
    limit = 100,
    filters?: any[],
    sorts?: any[]
  ) {
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    })
    if (filters) params.append("filters", JSON.stringify(filters))
    if (sorts) params.append("sorts", JSON.stringify(sorts))
    
    const { data } = await this.client.get(`/datasets/${id}/rows?${params}`)
    return data
  }

  async getSchema(id: string) {
    const { data } = await this.client.get(`/datasets/${id}/schema`)
    return data
  }

  // Search
  async search(id: string, query: string, options?: any) {
    const { data } = await this.client.post(`/datasets/${id}/search`, {
      query,
      ...options,
    })
    return data
  }

  async getSuggestions(id: string, prefix: string, limit = 10) {
    const { data } = await this.client.get(`/datasets/${id}/search/suggest`, {
      params: { q: prefix, limit },
    })
    return data
  }

  async buildSearchIndex(id: string) {
    const { data } = await this.client.post(`/datasets/${id}/search/index`)
    return data
  }

  // Analytics
  async getStats(id: string) {
    const { data } = await this.client.get(`/datasets/${id}/stats`)
    return data
  }

  async getProfile(id: string, options: { refresh?: boolean; sampleSize?: number } = {}) {
    const params = {
      ...(options.refresh ? { refresh: true } : {}),
      ...(options.sampleSize ? { sample_size: options.sampleSize } : {}),
    }
    const { data } = await this.client.get(`/datasets/${id}/profile`, { params })
    return data
  }

  async getSavedProfile(id: string) {
    const { data } = await this.client.get(`/datasets/${id}/profile/saved`)
    return data
  }

  async getDistribution(id: string, column: string, bins = 50) {
    const { data } = await this.client.get(`/datasets/${id}/distributions/${column}`, {
      params: { bins },
    })
    return data
  }

  async getOutliers(id: string, column: string, method = "iqr", threshold = 1.5) {
    const { data } = await this.client.get(`/datasets/${id}/outliers/${column}`, {
      params: { method, threshold },
    })
    return data
  }

  // Manipulation
  async addRow(id: string, data: Record<string, any>) {
    const { data: result } = await this.client.post(`/datasets/${id}/rows`, { data })
    return result
  }

  async updateRow(id: string, rowId: string, data: Record<string, any>) {
    const { data: result } = await this.client.put(`/datasets/${id}/rows/${rowId}`, { data })
    return result
  }

  async deleteRow(id: string, rowId: string) {
    const { data } = await this.client.delete(`/datasets/${id}/rows/${rowId}`)
    return data
  }

  async replaceValues(id: string, column: string, oldValue: any, newValue: any, caseSensitive = true) {
    const { data } = await this.client.post(`/datasets/${id}/replace`, {
      column,
      old_value: oldValue,
      new_value: newValue,
      case_sensitive: caseSensitive,
    })
    return data
  }

  async transform(id: string, operations: any[]) {
    const { data } = await this.client.post(`/datasets/${id}/transform`, { operations })
    return data
  }

  async commitChanges(id: string) {
    const { data } = await this.client.post(`/datasets/${id}/commit`)
    return data
  }

  async discardChanges(id: string) {
    const { data } = await this.client.post(`/datasets/${id}/discard`)
    return data
  }

  // Combine/Separate
  async combineDatasets(request: any) {
    const { data } = await this.client.post("/datasets/combine", request)
    return data
  }

  async separateDataset(request: any) {
    const { data } = await this.client.post("/datasets/separate", request)
    return data
  }

  async previewCombine(request: any) {
    const { data } = await this.client.post("/datasets/combine/preview", request)
    return data
  }

  // Export
  async exportDataset(id: string, request: any) {
    const { data } = await this.client.post(`/datasets/${id}/export`, request)
    return data
  }

  async exportStream(id: string, format: string, columns?: string[], compression?: string) {
    const params = new URLSearchParams({ format })
    if (columns) params.append("columns", JSON.stringify(columns))
    if (compression) params.append("compression", compression)
    
    return this.client.get(`/datasets/${id}/export/stream?${params}`, {
      responseType: "blob",
    })
  }

  async getExportFormats() {
    const { data } = await this.client.get("/export/formats")
    return data
  }
}

export const api = new ApiClient()