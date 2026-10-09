import * as React from "react"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { useToggles } from "@/hooks/useToggles"
import { useAITransform } from "./useAITransform"
import { useBrowseCopy } from "./useBrowseCopy"
import { useBrowseData } from "./useBrowseData"
import { useDataTools } from "./useDataTools"
import { useDatasetColumns } from "./useDatasetColumns"
import { useSearch } from "./useSearch"
import type { BrowsePanel } from "./BrowseActions"
import type { BrowseDialog } from "./BrowseDialogs"

/** Everything the Browse tab shows: the dataset or a transform result, search, tools and open panels. */
export function useBrowseTab() {
  const dataset = useSelectedDataset()
  const ai = useAITransform(dataset?.id)
  const tools = useDataTools(dataset?.id, ai.view?.id, ai.runSteps)
  const schema = ai.view?.schema ?? dataset?.schema
  const columns = useDatasetColumns(schema)
  const data = useBrowseData(dataset, ai.view)
  const search = useSearch(dataset?.id)
  const browseCopy = useBrowseCopy(dataset)
  const panels = useToggles<BrowsePanel>()
  const [dialog, setDialog] = React.useState<BrowseDialog>(null)
  const showingSearch = !ai.view && search.searched !== null
  return {
    dataset, ai, tools, schema, columns, columnNames: schema?.map((c) => c.name) ?? [], data, search, browseCopy,
    panels, dialog, setDialog, showingSearch, editable: !ai.view && !showingSearch,
  }
}
