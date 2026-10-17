import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { DataFormat, Dataset } from "@/types"
import { downloadBlob } from "@/lib/download"
import { ExportFormatInfo, ExportHistoryEntry } from "./formatIcons"

export function useExport(dataset: Dataset | undefined) {
  const [formats, setFormats] = React.useState<ExportFormatInfo[]>([])
  const [format, setFormat] = React.useState<DataFormat>("parquet")
  const [columns, setColumns] = React.useState<string[]>([])
  const [compression, setCompression] = React.useState("")
  const [partitionBy, setPartitionBy] = React.useState("")
  const [outputPath, setOutputPath] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [history, setHistory] = React.useState<ExportHistoryEntry[]>([])

  React.useEffect(() => {
    api.getExportFormats()
      .then((data: ExportFormatInfo[]) => {
        setFormats(data)
        if (data.length > 0) setFormat(data[0].format)
      })
      .catch(() => toast.error("Failed to load formats"))
  }, [])

  React.useEffect(() => {
    if (dataset) setColumns(dataset.schema.map((c) => c.name))
  }, [dataset])

  const validate = () => {
    if (!dataset) return false
    if (columns.length === 0) {
      toast.error("Select at least one column")
      return false
    }
    return true
  }

  const exportToFile = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const result = await api.exportDataset(dataset!.id, {
        dataset_id: dataset!.id,
        format,
        columns,
        compression: compression || undefined,
        partition_by: partitionBy || undefined,
        output_path: outputPath || undefined,
      })
      toast.success(`Exported ${formatNumber(result.rows)} rows to ${result.path}`)
      const entry = { id: Date.now().toString(), format, timestamp: new Date().toISOString(), rows: result.rows, path: result.path }
      setHistory((prev) => [entry, ...prev].slice(0, 10))
    } catch (error) {
      toast.error("Export failed")
    } finally {
      setLoading(false)
    }
  }

  const streamDownload = async () => {
    if (!validate()) return
    try {
      const response = await api.exportStream(dataset!.id, format, columns, compression || undefined)
      downloadBlob(await response.data, `${dataset!.name}_export.${format}`)
      toast.success("Stream export downloaded")
    } catch (error) {
      toast.error("Stream export failed")
    }
  }

  return {
    formats, format, setFormat, columns, setColumns,
    compression, setCompression, partitionBy, setPartitionBy, outputPath, setOutputPath,
    loading, history, exportToFile, streamDownload,
  }
}
