import * as React from "react"
import toast from "react-hot-toast"
import { editApi, type ReplaceBody, type ReplaceMode } from "@/lib/editApi"
import { useEditStore } from "@/stores/useEditStore"

const PREVIEW_DELAY = 400

export function useReplace(datasetId: string, columns: string[], onDone: () => void) {
  const [column, setColumn] = React.useState(columns[0] ?? "")
  const [find, setFind] = React.useState("")
  const [replaceWith, setReplaceWith] = React.useState("")
  const [mode, setMode] = React.useState<ReplaceMode>("contains")
  const [caseSensitive, setCaseSensitive] = React.useState(true)
  const [setNull, setSetNull] = React.useState(false)
  const [count, setCount] = React.useState<number | null>(null)
  const [previewError, setPreviewError] = React.useState("")
  const [replacing, setReplacing] = React.useState(false)
  const edited = useEditStore((s) => s.edited)

  const body: ReplaceBody = {
    column,
    old_value: find,
    new_value: mode === "exact" && setNull ? null : replaceWith,
    mode,
    case_sensitive: caseSensitive,
  }

  React.useEffect(() => {
    setCount(null)
    setPreviewError("")
    if (!column || !find) return
    let stale = false
    const timer = window.setTimeout(() => {
      editApi
        .previewReplace(datasetId, body)
        .then((n) => !stale && setCount(n))
        .catch((e) => !stale && setPreviewError(e?.response?.data?.detail ?? "Could not count matches"))
    }, PREVIEW_DELAY)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, column, find, mode, caseSensitive])

  const replace = async () => {
    setReplacing(true)
    try {
      const n = await editApi.replace(datasetId, body)
      await edited(datasetId)
      toast.success(`Replaced in ${n.toLocaleString()} rows (not yet saved to file)`)
      onDone()
    } catch {
      // the API client shows the error
    } finally {
      setReplacing(false)
    }
  }

  return {
    column, setColumn, find, setFind, replaceWith, setReplaceWith, mode, setMode,
    caseSensitive, setCaseSensitive, setNull, setSetNull, count, previewError, replacing, replace,
  }
}
