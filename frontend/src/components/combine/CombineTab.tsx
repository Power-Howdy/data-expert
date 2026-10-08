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
    <div className="flex h-full flex-col gap-5">
      <PageHeader title="Combine & Separate" subtitle={`${datasets.length} datasets loaded`} />
      <Tabs defaultValue="combine" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="combine">Combine</TabsTrigger>
          <TabsTrigger value="separate">Separate</TabsTrigger>
        </TabsList>
        <TabsContent value="combine" className="mt-4 flex flex-1 flex-col">
          <CombinePanel datasets={datasets} state={combine} />
        </TabsContent>
        <TabsContent value="separate" className="mt-4 flex flex-1 flex-col">
          <SeparatePanel datasets={datasets} state={separate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
