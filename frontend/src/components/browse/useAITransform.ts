import * as React from "react"
import toast from "react-hot-toast"
import { aiApi } from "@/lib/aiApi"
import { transformApi } from "@/lib/transformApi"
import { useEditStore } from "@/stores/useEditStore"
import type { AIJob, DataView, PlanStep, TransformPlan } from "@/types/ai"

const POLL_MS = 800

export function useAITransform(datasetId: string | undefined) {
  const [prompt, setPrompt] = React.useState("")
  const [plan, setPlan] = React.useState<TransformPlan | null>(null)
  const [planning, setPlanning] = React.useState(false)
  const [job, setJob] = React.useState<AIJob | null>(null)
  const [view, setView] = React.useState<DataView | null>(null)
  const [submitted, setSubmitted] = React.useState("")
  const [applying, setApplying] = React.useState(false)

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
          toast.success(`Result ready: ${next.view.total.toLocaleString()} rows`)
        } else if (next.status === "error") {
          toast.error(next.error || "Transform failed")
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

  /** Runs hand-picked tool steps through the same executor; the result replaces or refines the current view. */
  const runSteps = async (steps: PlanStep[], description: string) => {
    if (!datasetId || !steps.length) return
    setPlan(null)
    setJob(await transformApi.run(datasetId, { steps, description, viewId: view?.id }))
  }

  const cancel = () => job && aiApi.cancelJob(job.id)

  const discardView = () => {
    if (view) aiApi.deleteView(view.id)
    setView(null)
    setJob(null)
  }

  const applyView = async () => {
    if (!view || !datasetId) return
    setApplying(true)
    try {
      await aiApi.applyView(view.id)
      setView(null)
      setJob(null)
      await useEditStore.getState().edited(datasetId)
      toast.success("Applied to the dataset (not yet saved to file)")
    } catch {
      // error toast comes from the API client
    } finally {
      setApplying(false)
    }
  }

  return {
    prompt, setPrompt, plan, setPlan, planning, makePlan, run, runSteps, cancel,
    job, running: job?.status === "running", view, discardView, applyView, applying,
  }
}

export type AITransform = ReturnType<typeof useAITransform>
