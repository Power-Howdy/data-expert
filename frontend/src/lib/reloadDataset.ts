import { api } from "@/lib/api"
import { useDatasetStore } from "@/stores/useStore"
import { useEditStore } from "@/stores/useEditStore"

/** Refetch a dataset after its file changed (row count, schema, stats) and refresh row lists. */
export async function reloadDataset(datasetId: string) {
  const fresh = await api.getDataset(datasetId)
  const store = useDatasetStore.getState()
  store.setDatasets(store.datasets.map((d) => (d.id === datasetId ? fresh : d)))
  await useEditStore.getState().edited(datasetId)
}
