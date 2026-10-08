import * as React from "react"
import { aiApi } from "@/lib/aiApi"
import type { AIInsights } from "@/types/ai"

export function useAIInsights(datasetId: string) {
  const [insights, setInsights] = React.useState<AIInsights | null>(null)
  const [focus, setFocus] = React.useState("")
  const [generating, setGenerating] = React.useState(false)
  const latestId = React.useRef(datasetId)
  latestId.current = datasetId

  React.useEffect(() => {
    let cancelled = false
    setInsights(null)
    setFocus("")
    setGenerating(false)
    aiApi.getSavedInsights(datasetId)
      .then((saved) => {
        if (cancelled || !saved) return
        setInsights(saved)
        setFocus(saved.focus)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [datasetId])

  const generate = async () => {
    const id = datasetId
    setGenerating(true)
    try {
      const result = await aiApi.generateInsights(id, focus)
      if (id === latestId.current) setInsights(result)
    } catch {
      // error toast comes from the API client
    } finally {
      if (id === latestId.current) setGenerating(false)
    }
  }

  return { insights, focus, setFocus, generating, generate }
}
