import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingButton } from "@/components/common/LoadingButton"
import { PageHeader } from "@/components/common/PageHeader"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { formatNumber } from "@/lib/utils"
import { useExport } from "./useExport"
import { FormatPicker } from "./FormatPicker"
import { ExportOptions } from "./ExportOptions"
import { ColumnPicker } from "./ColumnPicker"
import { ExportHistory } from "./ExportHistory"

export function ExportTab() {
  const dataset = useSelectedDataset()
  const e = useExport(dataset)

  if (!dataset) return <EmptyState>Select a dataset from the sidebar to export</EmptyState>

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <PageHeader
        title={`${dataset.name} Export`}
        subtitle={`${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns`}
      />
      <Tabs defaultValue="configure" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configure">Configure Export</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="configure" className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-2 space-y-4">
            <FormatPicker formats={e.formats} selected={e.format} onSelect={e.setFormat} />
            <ExportOptions
              columns={dataset.schema.map((c) => c.name)}
              compression={e.compression}
              onCompressionChange={e.setCompression}
              partitionBy={e.partitionBy}
              onPartitionByChange={e.setPartitionBy}
              outputPath={e.outputPath}
              onOutputPathChange={e.setOutputPath}
            />
            <ColumnPicker schema={dataset.schema} selected={e.columns} onChange={e.setColumns} />
          </ScrollArea>
          <Separator />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={e.streamDownload} disabled={e.loading}>
              <Download className="h-4 w-4 mr-2" />
              Stream Download
            </Button>
            <LoadingButton onClick={e.exportToFile} loading={e.loading} loadingText="Exporting...">
              Export to File
            </LoadingButton>
          </div>
        </TabsContent>
        <TabsContent value="history" className="flex-1">
          <ExportHistory entries={e.history} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
