import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { formatNumber } from "@/lib/utils"
import { DataFormat } from "@/types"
import { CombineStrategy, JoinConfig } from "./constants"

export function useCombine() {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [strategy, setStrategy] = React.useState<CombineStrategy>("concat")
  const [joinConfig, setJoinConfig] = React.useState<JoinConfig>({ leftOn: "", rightOn: "", how: "inner" })
  const [outputName, setOutputName] = React.useState("")
  const [outputFormat, setOutputFormat] = React.useState<DataFormat>("parquet")
  const [loading, setLoading] = React.useState(false)
  const [preview, setPreview] = React.useState<any[] | null>(null)

  const toggleDataset = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]))

  const baseRequest = () => ({
    dataset_ids: selectedIds,
    strategy,
    join_config: strategy !== "concat" ? joinConfig : undefined,
  })

  const combine = async () => {
    if (selectedIds.length < 2) return void toast.error("Select at least 2 datasets")
    if (!outputName.trim()) return void toast.error("Enter output name")
    setLoading(true)
    try {
      const result = await api.combineDatasets({ ...baseRequest(), output_name: outputName, output_format: outputFormat })
      toast.success(`Combined into ${result.name} (${formatNumber(result.row_count)} rows)`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Combine failed")
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async () => {
    if (selectedIds.length < 2) return
    setLoading(true)
    try {
      const result = await api.previewCombine(baseRequest())
      setPreview(result.preview)
    } catch (error) {
      toast.error("Preview failed")
    } finally {
      setLoading(false)
    }
  }

  return {
    selectedIds, toggleDataset, strategy, setStrategy, joinConfig, setJoinConfig,
    outputName, setOutputName, outputFormat, setOutputFormat,
    loading, preview, combine, loadPreview,
  }
}
