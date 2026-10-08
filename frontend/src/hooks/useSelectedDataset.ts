import { useDatasetStore } from "@/stores/useStore"

export function useSelectedDataset() {
  const { selectedDatasetId, datasets } = useDatasetStore()
  return datasets.find((d) => d.id === selectedDatasetId)
}
