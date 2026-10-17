import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Dataset, DataFormat } from "@/types"

export function useSeparate() {
  const [datasetId, setDatasetId] = React.useState("")
  const [column, setColumn] = React.useState("")
  const [outputDir, setOutputDir] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState<DataFormat>("parquet")
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<Dataset[] | null>(null)

  const canSubmit = Boolean(datasetId && column && outputDir)

  const separate = async () => {
    if (!canSubmit) return void toast.error("Fill all fields")
    setLoading(true)
    try {
      const datasets = await api.separateDataset({
        dataset_id: datasetId,
        column,
        output_dir: outputDir,
        output_format: outputFormat,
      })
      toast.success(`Separated into ${datasets.length} datasets`)
      setResult(datasets)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Separate failed")
    } finally {
      setLoading(false)
    }
  }

  return {
    datasetId, setDatasetId, column, setColumn, outputDir, setOutputDir,
    outputFormat, setOutputFormat, loading, result, canSubmit, separate,
  }
}
