import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/PageHeader"
import { useDatasetStore } from "@/stores/useStore"
import { useCombine } from "./useCombine"
import { useSeparate } from "./useSeparate"
import { CombinePanel } from "./CombinePanel"
import { SeparatePanel } from "./SeparatePanel"

export function CombineTab() {
  const { datasets } = useDatasetStore()
  const combine = useCombine()
  const separate = useSeparate()

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <PageHeader title="Combine & Separate" subtitle={`${datasets.length} datasets loaded`} />
      <Tabs defaultValue="combine" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="combine">Combine Datasets</TabsTrigger>
          <TabsTrigger value="separate">Separate Dataset</TabsTrigger>
        </TabsList>
        <TabsContent value="combine" className="flex-1 flex flex-col">
          <CombinePanel datasets={datasets} state={combine} />
        </TabsContent>
        <TabsContent value="separate" className="flex-1 flex flex-col">
          <SeparatePanel datasets={datasets} state={separate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
