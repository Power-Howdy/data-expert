import { ScrollArea } from "@/components/ui/scroll-area"
import { Dataset } from "@/types"
import { getCommonColumns } from "./constants"
import { useCombine } from "./useCombine"
import { DatasetMultiSelect } from "./DatasetMultiSelect"
import { StrategyCard } from "./StrategyCard"
import { CombineOutputCard } from "./CombineOutputCard"
import { PreviewCard } from "./PreviewCard"

interface CombinePanelProps {
  datasets: Dataset[]
  state: ReturnType<typeof useCombine>
}

export function CombinePanel({ datasets, state: c }: CombinePanelProps) {
  const canRun = c.selectedIds.length >= 2

  return (
    <>
      <ScrollArea className="flex-1 p-2 space-y-4">
        <DatasetMultiSelect datasets={datasets} selectedIds={c.selectedIds} onToggle={c.toggleDataset} />
        {canRun && (
          <StrategyCard
            strategy={c.strategy}
            onStrategyChange={c.setStrategy}
            joinConfig={c.joinConfig}
            onJoinConfigChange={c.setJoinConfig}
            commonColumns={getCommonColumns(datasets, c.selectedIds)}
          />
        )}
        <CombineOutputCard
          outputName={c.outputName}
          onOutputNameChange={c.setOutputName}
          outputFormat={c.outputFormat}
          onOutputFormatChange={c.setOutputFormat}
          loading={c.loading}
          canRun={canRun}
          onPreview={c.loadPreview}
          onCombine={c.combine}
        />
      </ScrollArea>
      {c.preview && <PreviewCard rows={c.preview} />}
    </>
  )
}
