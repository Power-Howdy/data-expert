"use client"
import * as React from "react"
import { useDatasetStore } from "@/stores/useStore"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Loader2, Download, FileText, Database, FileSpreadsheet, FileCode, Settings, ChevronDown } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"
import { Dataset, DataFormat, ExportRequest, ColumnSchema } from "@/types"
import toast from "react-hot-toast"

const formatIcons: Record<DataFormat, React.ReactNode> = {
  parquet: <Database className="h-4 w-4" />,
  csv: <FileSpreadsheet className="h-4 w-4" />,
  tsv: <FileSpreadsheet className="h-4 w-4" />,
  json: <FileCode className="h-4 w-4" />,
  jsonl: <FileCode className="h-4 w-4" />,
  feather: <Database className="h-4 w-4" />,
  avro: <Database className="h-4 w-4" />,
  orc: <Database className="h-4 w-4" />,
  "json.gz": <FileCode className="h-4 w-4" />,
  xlsx: <FileSpreadsheet className="h-4 w-4" />,
  xls: <FileSpreadsheet className="h-4 w-4" />,
}

const formatDescriptions: Record<DataFormat, string> = {
  parquet: "Columnar format, efficient for analytics",
  csv: "Comma-separated values, universal compatibility",
  tsv: "Tab-separated values",
  json: "JavaScript Object Notation",
  jsonl: "Newline-delimited JSON, streaming friendly",
  feather: "Fast, lightweight columnar format",
  avro: "Row-based format with schema",
  orc: "Optimized row columnar format",
  "json.gz": "Compressed JSON Lines",
  xlsx: "Excel spreadsheet",
  xls: "Legacy Excel format",
}

export function ExportTab() {
  const { selectedDatasetId, datasets } = useDatasetStore()
  const dataset = datasets.find(d => d.id === selectedDatasetId)

  const [formats, setFormats] = React.useState<Array<{format: DataFormat; name: string; description: string; supports_compression: boolean; supports_partitioning: boolean; extensions: string[]}>>([])
  const [selectedFormat, setSelectedFormat] = React.useState<DataFormat>("parquet")
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([])
  const [compression, setCompression] = React.useState<string>("")
  const [partitionBy, setPartitionBy] = React.useState<string>("")
  const [outputPath, setOutputPath] = React.useState<string>("")
  const [loading, setLoading] = React.useState(false)
  const [exportHistory, setExportHistory] = React.useState<Array<{id: string; format: DataFormat; timestamp: string; rows: number; path: string}>>([])

  React.useEffect(() => {
    loadFormats()
  }, [])

  const loadFormats = async () => {
    try {
      const data = await api.getExportFormats()
      setFormats(data)
      if (data.length > 0) setSelectedFormat(data[0].format)
    } catch (error) {
      toast.error("Failed to load formats")
    }
  }

  React.useEffect(() => {
    if (dataset) {
      setSelectedColumns(dataset.schema.map(c => c.name))
    }
  }, [dataset])

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev => 
      prev.includes(column) 
        ? prev.filter(c => c !== column) 
        : [...prev, column]
    )
  }

  const selectAllColumns = () => {
    if (dataset) {
      setSelectedColumns(dataset.schema.map(c => c.name))
    }
  }

  const deselectAllColumns = () => {
    setSelectedColumns([])
  }

  const handleExport = async () => {
    if (!dataset) return
    if (selectedColumns.length === 0) {
      toast.error("Select at least one column")
      return
    }

    setLoading(true)
    try {
      const request: ExportRequest = {
        dataset_id: dataset.id,
        format: selectedFormat,
        columns: selectedColumns,
        compression: compression || undefined,
        partition_by: partitionBy || undefined,
        output_path: outputPath || undefined,
      }

      const result = await api.exportDataset(dataset.id, request)
      toast.success(`Exported ${formatNumber(result.rows)} rows to ${result.path}`)
      
      setExportHistory(prev => [{
        id: Date.now().toString(),
        format: selectedFormat,
        timestamp: new Date().toISOString(),
        rows: result.rows,
        path: result.path,
      }, ...prev].slice(0, 10))
    } catch (error) {
      toast.error("Export failed")
    } finally {
      setLoading(false)
    }
  }

  const handleStreamExport = async () => {
    if (!dataset) return
    if (selectedColumns.length === 0) {
      toast.error("Select at least one column")
      return
    }

    try {
      const response = await api.exportStream(dataset.id, selectedFormat, selectedColumns, compression || undefined)
      const blob = await response.data
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset.name}_export.${selectedFormat}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Stream export downloaded")
    } catch (error) {
      toast.error("Stream export failed")
    }
  }

  const currentFormat = formats.find(f => f.format === selectedFormat)

  if (!dataset) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a dataset from the sidebar to export
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name} Export</h1>
          <p className="text-muted-foreground">
            {formatNumber(dataset.row_count)} rows · {dataset.column_count} columns
          </p>
        </div>
      </div>

      <Tabs defaultValue="configure" className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configure">Configure Export</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="configure" className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Output Format
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {formats.map((fmt) => (
                    <button
                      key={fmt.format}
                      onClick={() => setSelectedFormat(fmt.format)}
                      className={cn(
                        "p-4 rounded-lg border-2 transition-all text-left",
                        selectedFormat === fmt.format 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {formatIcons[fmt.format]}
                        <span className="font-medium">{fmt.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{fmt.description}</p>
                      <div className="flex gap-1 mt-2">
                        {fmt.supports_compression && <Badge variant="secondary" className="text-xs">Compression</Badge>}
                        {fmt.supports_partitioning && <Badge variant="outline" className="text-xs">Partitioning</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Compression</label>
                  <Select value={compression} onValueChange={setCompression}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="gzip">GZIP</SelectItem>
                      <SelectItem value="zstd">ZSTD</SelectItem>
                      <SelectItem value="snappy">Snappy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Partition By Column</label>
                  <Select value={partitionBy} onValueChange={setPartitionBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="No partitioning" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No partitioning</SelectItem>
                      {dataset.schema.map(col => (
                        <SelectItem key={col.name} value={col.name}>{col.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Only available for Parquet format</p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Output Path (optional)</label>
                  <Input
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="Leave empty for auto-generated path"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Columns ({selectedColumns.length}/{dataset.schema.length})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllColumns}>Select All</Button>
                    <Button variant="ghost" size="sm" onClick={deselectAllColumns}>Deselect All</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-auto">
                  {dataset.schema.map((col) => (
                    <label key={col.name} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedColumns.includes(col.name)}
                        onCheckedChange={() => toggleColumn(col.name)}
                      />
                      <span className="text-sm">{col.name}</span>
                      <Badge variant="outline" className="text-xs ml-auto">{col.type}</Badge>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollArea>

          <Separator />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleStreamExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Stream Download
            </Button>
            <Button onClick={handleExport} disabled={loading}>
              <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              {loading ? "Exporting..." : "Export to File"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1">
          {exportHistory.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No export history yet
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {exportHistory.map((exp) => (
                <Card key={exp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {formatIcons[exp.format]}
                        <div>
                          <p className="font-medium">{exp.format.toUpperCase()}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(exp.rows)} rows · {new Date(exp.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {exp.path}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}