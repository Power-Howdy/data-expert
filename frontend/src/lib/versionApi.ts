import { api } from "@/lib/api"
import type { Dataset } from "@/types"
import type { VersionCommit, VersionDiff, VersionFormat, VersionHistory, VersionRows } from "@/types/version"

const http = api.client
const LONG = { timeout: 0 }

/** Version history of a dataset's file (commits, restore, compare, tags). */
export const versionApi = {
  async history(datasetId: string): Promise<VersionHistory> {
    return (await http.get(`/datasets/${datasetId}/versions`, LONG)).data
  },
  async start(datasetId: string): Promise<VersionHistory> {
    return (await http.post(`/datasets/${datasetId}/versions/init`, null, LONG)).data
  },
  async rows(datasetId: string, ref: string, offset: number, limit: number): Promise<VersionRows> {
    return (await http.get(`/datasets/${datasetId}/versions/${ref}/rows`, { ...LONG, params: { offset, limit } })).data
  },
  async diff(datasetId: string, a: string, b: string, rows = false): Promise<VersionDiff> {
    return (await http.get(`/datasets/${datasetId}/versions/diff`, { ...LONG, params: { a, b, rows } })).data
  },
  async restore(datasetId: string, ref: string): Promise<VersionCommit> {
    return (await http.post(`/datasets/${datasetId}/versions/${ref}/restore`, null, LONG)).data
  },
  async saveAs(datasetId: string, ref: string, body: { name: string; format: VersionFormat; overwrite: boolean }): Promise<Dataset> {
    const config = { ...LONG, silent: true } as object
    return (await http.post(`/datasets/${datasetId}/versions/${ref}/save-as`, body, config)).data
  },
  async tag(datasetId: string, name: string, commitId: string): Promise<VersionHistory> {
    return (await http.post(`/datasets/${datasetId}/versions/tags`, { name, commit_id: commitId })).data
  },
  async untag(datasetId: string, name: string): Promise<VersionHistory> {
    return (await http.delete(`/datasets/${datasetId}/versions/tags/${encodeURIComponent(name)}`)).data
  },
  async configure(datasetId: string, keepSnapshots: number): Promise<VersionHistory> {
    return (await http.put(`/datasets/${datasetId}/versions/settings`, { keep_snapshots: keepSnapshots })).data
  },
  async destroy(datasetId: string): Promise<void> {
    await http.delete(`/datasets/${datasetId}/versions`)
  },
}
