import { ScrollArea } from "@/components/ui/scroll-area"
import { Dataset } from "@/types"
import { useSeparate } from "./useSeparate"
import { SeparateForm } from "./SeparateForm"
import { SeparateResults } from "./SeparateResults"

interface SeparatePanelProps {
  datasets: Dataset[]
  state: ReturnType<typeof useSeparate>
}

export function SeparatePanel({ datasets, state }: SeparatePanelProps) {
  return (
    <>
      <ScrollArea className="flex-1 p-2 space-y-4">
        <SeparateForm datasets={datasets} state={state} />
      </ScrollArea>
      {state.result && state.result.length > 0 && <SeparateResults datasets={state.result} />}
    </>
  )
}
