import * as React from "react"
import toast from "react-hot-toast"
import { aiApi } from "@/lib/aiApi"
import type { AIJob, DataView, TransformPlan } from "@/types/ai"

const POLL_MS = 800

export function useAITransform(datasetId: string | undefined) {
  const [prompt, setPrompt] = React.useState("")
  const [plan, setPlan] = React.useState<TransformPlan | null>(null)
  const [planning, setPlanning] = React.useState(false)
  const [job, setJob] = React.useState<AIJob | null>(null)
  const [view, setView] = React.useState<DataView | null>(null)
  const [submitted, setSubmitted] = React.useState("")

  React.useEffect(() => {
    setPrompt("")
    setPlan(null)
    setJob(null)
    setView(null)
  }, [datasetId])

  React.useEffect(() => {
    if (!job || job.status !== "running") return
    const timer = window.setTimeout(async () => {
      try {
        const next = await aiApi.getJob(job.id)
        setJob(next)
        if (next.status === "done" && next.view) {
          setView(next.view)
          setPlan(null)
          toast.success(`AI result ready: ${next.view.total.toLocaleString()} rows`)
        } else if (next.status === "error") {
          toast.error(next.error || "AI transform failed")
        }
      } catch {
        setJob(null)
      }
    }, POLL_MS)
    return () => window.clearTimeout(timer)
  }, [job])

  const makePlan = async (text = prompt) => {
    if (!datasetId || !text.trim()) return
    setPrompt(text)
    setPlanning(true)
    setPlan(null)
    try {
      setPlan(await aiApi.plan(datasetId, text.trim(), view?.id))
      setSubmitted(text.trim())
    } catch {
      // error toast comes from the API client
    } finally {
      setPlanning(false)
    }
  }

  const run = async () => {
    if (!datasetId || !plan) return
    setJob(await aiApi.apply(datasetId, plan, submitted, view?.id))
  }

  const cancel = () => job && aiApi.cancelJob(job.id)

  const discardView = () => {
    if (view) aiApi.deleteView(view.id)
    setView(null)
    setJob(null)
  }

  return {
    prompt, setPrompt, plan, setPlan, planning, makePlan, run, cancel,
    job, running: job?.status === "running", view, discardView,
  }
}

export type AITransform = ReturnType<typeof useAITransform>
