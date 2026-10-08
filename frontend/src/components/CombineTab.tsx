"use client"
import * as React from "react"
import { useDatasetStore } from "@/stores/useStore"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Minus, ArrowRight, Database, Loader2, Search, ChevronDown, Settings, Download } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"
import { Dataset, DataFormat, CombineRequest, SeparateRequest } from "@/types"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import toast from "react-hot-toast"

const combineStrategies = [
  { value: "concat", label: "Concatenate (Vertical)", description: "Stack datasets vertically, aligning columns by name" },
  { value: "join", label: "Join (Horizontal)", description: "Join datasets on common keys (requires 2 datasets)" },
  { value: "merge", label: "Merge (Outer Join)", description: "Merge all datasets on common keys with coalesce" },
]

const joinTypes = [
  { value: "inner", label: "Inner Join" },
  { value: "left", label: "Left Join" },
  { value: "right", label: "Right Join" },
  { value: "outer", label: "Full Outer Join" },
]

export function CombineTab() {
  const { datasets, selectedDatasetId } = useDatasetStore()

  const [activeTab, setActiveTab] = React.useState<"combine" | "separate">("combine")
  const [selectedDatasets, setSelectedDatasets] = React.useState<string[]>([])
  const [strategy, setStrategy] = React.useState<"concat" | "join" | "merge">("concat")
  const [joinConfig, setJoinConfig] = React.useState<{ leftOn: string; rightOn: string; how: string }>({
    leftOn: "",
    rightOn: "",
    how: "inner",
  })
  const [outputName, setOutputName] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState<DataFormat>("parquet")
  const [loading, setLoading] = React.useState(false)
  const [preview, setPreview] = React.useState<any>(null)
  const [previewColumns, setPreviewColumns] = React.useState<string[]>([])

  // Separate tab state
  const [separateDatasetId, setSeparateDatasetId] = React.useState<string>("")
  const [separateColumn, setSeparateColumn] = React.useState("")
  const [separateOutputDir, setSeparateOutputDir] = React.useState("")
  const [separateOutputFormat, setSeparateOutputFormat] = React.useState<DataFormat>("parquet")
  const [separateLoading, setSeparateLoading] = React.useState(false)
  const [separateResult, setSeparateResult] = React.useState<any>(null)

  const handleToggleDataset = (id: string) => {
    setSelectedDatasets(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const handleCombine = async () => {
    if (selectedDatasets.length < 2) {
      toast.error("Select at least 2 datasets")
      return
    }
    if (!outputName.trim()) {
      toast.error("Enter output name")
      return
    }

    setLoading(true)
    try {
      const request: CombineRequest = {
        dataset_ids: selectedDatasets,
        strategy,
        join_config: strategy !== "concat" ? joinConfig : undefined,
        output_name: outputName,
        output_format: outputFormat,
      }
      const result = await api.combineDatasets(request)
      toast.success(`Combined into ${result.name} (${formatNumber(result.row_count)} rows)`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Combine failed")
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (selectedDatasets.length < 2) return
    setLoading(true)
    try {
      const result = await api.previewCombine(selectedDatasets, strategy, strategy !== "concat" ? joinConfig : undefined)
      setPreview(result.preview)
      setPreviewColumns(Object.keys(result.preview[0] || {}))
    } catch (error) {
      toast.error("Preview failed")
    } finally {
      setLoading(false)
    }
  }

  const handleSeparate = async () => {
    if (!separateDatasetId || !separateColumn || !separateOutputDir) {
      toast.error("Fill all fields")
      return
    }

    setSeparateLoading(true)
    try {
      const request: SeparateRequest = {
        dataset_id: separateDatasetId,
        column: separateColumn,
        output_dir: separateOutputDir,
        output_format: separateOutputFormat,
      }
      const result = await api.separateDataset(request)
      toast.success(`Separated into ${result.length} datasets`)
      setSeparateResult(result)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Separate failed")
    } finally {
      setSeparateLoading(false)
    }
  }

  const datasetForSeparate = datasets.find(d => d.id === separateDatasetId)
  const separateColumns = datasetForSeparate?.schema.map(c => c.name) || []

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Combine & Separate</h1>
          <p className="text-muted-foreground">
            {datasets.length} datasets loaded
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="combine">Combine Datasets</TabsTrigger>
          <TabsTrigger value="separate">Separate Dataset</TabsTrigger>
        </TabsList>

        <TabsContent value="combine" className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Select Datasets to Combine ({selectedDatasets.length} selected)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {datasets.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No datasets loaded</p>
                ) : (
                  <div className="grid gap-2 max-h-60 overflow-auto">
                    {datasets.map((dataset) => (
                      <label
                        key={dataset.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                          selectedDatasets.includes(dataset.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedDatasets.includes(dataset.id)}
                            onChange={() => handleToggleDataset(dataset.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <p className="font-medium">{dataset.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatNumber(dataset.row_count)} rows · {dataset.column_count} cols · {dataset.format}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{dataset.format}</Badge>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedDatasets.length >= 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Combine Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Strategy</label>
                    <Select value={strategy} onValueChange={setStrategy}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {combineStrategies.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            <div>
                              <p className="font-medium">{s.label}</p>
                              <p className="text-xs text-muted-foreground">{s.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(strategy === "join" || strategy === "merge") && (
                    <>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="text-sm font-medium block mb-2">Left Column</label>
                        <Select value={joinConfig.leftOn} onValueChange={(v) => setJoinConfig({...joinConfig, leftOn: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {getCommonColumns().map((col) => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-center">
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <label className="text-sm font-medium block mb-2">Right Column</label>
                        <Select value={joinConfig.rightOn} onValueChange={(v) => setJoinConfig({...joinConfig, rightOn: v})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {getCommonColumns().map((col) => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
</div>
                    {strategy === "join" && (
                      <div>
                        <label className="text-sm font-medium block mb-2">Join Type</label>
                        <Select value={joinConfig.how} onValueChange={(v) => setJoinConfig({...joinConfig, how: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {joinTypes.map((j) => (
                              <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Output Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium block mb-2">Output Name</label>
                    <Input
                      value={outputName}
                      onChange={(e) => setOutputName(e.target.value)}
                      placeholder="combined_dataset"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">Output Format</label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["parquet", "csv", "json", "jsonl", "feather"].map((f) => (
                          <SelectItem key={f} value={f as DataFormat}>{f.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePreview} disabled={loading || selectedDatasets.length < 2}>
                    <Search className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handleCombine} disabled={loading || selectedDatasets.length < 2 || !outputName}>
                    <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                    {loading ? "Combining..." : "Combine Datasets"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ScrollArea>

          {preview && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Preview ({preview.length} rows)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={previewColumns.map(col => ({
                    accessorKey: col,
                    header: col,
                  }))}
                  data={preview}
                  pageSize={10}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="separate" className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Minus className="h-5 w-5" />
                  Separate Dataset by Column
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Dataset</label>
                  <Select value={separateDatasetId} onValueChange={setSeparateDatasetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name} ({formatNumber(d.row_count)} rows)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Column to Separate By</label>
                  <Select value={separateColumn} onValueChange={setSeparateColumn} disabled={!separateDatasetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {separateColumns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Output Directory</label>
                  <Input
                    value={separateOutputDir}
                    onChange={(e) => setSeparateOutputDir(e.target.value)}
                    placeholder="./separated_output"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Output Format</label>
                  <Select value={separateOutputFormat} onValueChange={setSeparateOutputFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["parquet", "csv", "json", "jsonl", "feather"].map((f) => (
                        <SelectItem key={f} value={f as DataFormat}>{f.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSeparate} disabled={separateLoading || !separateDatasetId || !separateColumn || !separateOutputDir}>
                    <Loader2 className={cn("h-4 w-4 mr-2", separateLoading && "animate-spin")} />
                    {separateLoading ? "Separating..." : "Separate Dataset"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ScrollArea>

          {separateResult && separateResult.length > 0 && (
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Download className="h-5 w-5" />
                  Separated into {separateResult.length} datasets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {separateResult.map((ds: any) => (
                    <div key={ds.id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5" />
                        <div>
                          <p className="font-medium">{ds.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(ds.row_count)} rows · {ds.format}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{ds.path}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function getCommonColumns() {
  const { datasets, selectedDatasets } = useDatasetStore.getState()
  if (selectedDatasets.length < 2) return []
  
  const selected = datasets.filter(d => selectedDatasets.includes(d.id))
  if (selected.length < 2) return []
  
  const cols1 = new Set(selected[0].schema.map(c => c.name))
  const cols2 = new Set(selected[1].schema.map(c => c.name))
  
  return Array.from(cols1).filter(c => cols2.has(c))
}