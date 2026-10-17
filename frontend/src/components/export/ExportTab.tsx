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

  if (!dataset) {
    return (
      <EmptyState icon={<Download className="h-9 w-9" />} title="Nothing to export">
        Select a loaded dataset first, then pick a format and columns
      </EmptyState>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        title={`${dataset.name} Export`}
        subtitle={`${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns`}
      />
      <Tabs defaultValue="configure" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="configure" className="mt-4 flex flex-1 flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-3 pb-4">
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
            </div>
          </ScrollArea>
          <Separator className="my-4" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={e.streamDownload} disabled={e.loading}>
              <Download className="h-4 w-4" />
              Stream Download
            </Button>
            <LoadingButton onClick={e.exportToFile} loading={e.loading} loadingText="Exporting...">
              Export to File
            </LoadingButton>
          </div>
        </TabsContent>
        <TabsContent value="history" className="mt-4 flex-1">
          <ExportHistory entries={e.history} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
