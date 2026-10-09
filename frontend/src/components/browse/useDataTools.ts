import * as React from "react"
import { transformApi } from "@/lib/transformApi"
import type { FunctionSpec, PlanStep, StepsPreview } from "@/types/ai"
import { draftDefaults, toParams, type Draft, type DraftValue } from "./toolParams"

const PREVIEW_DELAY_MS = 300

/** Build a pipeline by hand from the function library: pick a tool, fill its parameters, add it as a step. Steps
 * are previewed on the first rows as they change and run through `onRun` (the same executor as AI plans). */
export function useDataTools(
  datasetId: string | undefined, viewId: string | undefined,
  onRun: (steps: PlanStep[], description: string) => Promise<void>,
) {
  const [functions, setFunctions] = React.useState<FunctionSpec[]>([])
  const [selected, setSelected] = React.useState<FunctionSpec | null>(null)
  const [draft, setDraft] = React.useState<Draft>({})
  const [formError, setFormError] = React.useState("")
  const [steps, setSteps] = React.useState<PlanStep[]>([])
  const [preview, setPreview] = React.useState<StepsPreview | null>(null)
  const [previewError, setPreviewError] = React.useState("")
  const [previewing, setPreviewing] = React.useState(false)

  React.useEffect(() => {
    transformApi.listFunctions().then(setFunctions).catch(() => setFunctions([]))
  }, [])

  React.useEffect(() => setSteps([]), [datasetId])

  React.useEffect(() => {
    setPreview(null)
    setPreviewError("")
    if (!datasetId || !steps.length) return
    let stale = false
    const timer = window.setTimeout(() => {
      setPreviewing(true)
      transformApi.preview(datasetId, { steps, viewId })
        .then((result) => !stale && setPreview(result))
        .catch((e) => !stale && setPreviewError(e?.response?.data?.detail ?? "Could not preview these steps"))
        .finally(() => !stale && setPreviewing(false))
    }, PREVIEW_DELAY_MS)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [datasetId, viewId, steps])

  const select = (name: string) => {
    const spec = functions.find((f) => f.name === name) ?? null
    setSelected(spec)
    setDraft(spec ? draftDefaults(spec) : {})
    setFormError("")
  }

  const setParam = (name: string, value: DraftValue) => setDraft((d) => ({ ...d, [name]: value }))

  const addStep = () => {
    if (!selected) return
    try {
      const params = toParams(selected, draft)
      setSteps((s) => [...s, { op: selected.name, description: selected.title || selected.name, params }])
      setFormError("")
      select("")
    } catch (e) {
      setFormError((e as Error).message)
    }
  }

  const removeStep = (index: number) => setSteps((s) => s.filter((_, i) => i !== index))

  const moveStep = (index: number, by: -1 | 1) => setSteps((s) => {
    const next = [...s]
    const [step] = next.splice(index, 1)
    next.splice(index + by, 0, step)
    return next
  })

  const run = async () => {
    await onRun(steps, steps.map((s) => s.description).join(" → "))
    setSteps([])
  }

  return {
    functions, selected, select, draft, setParam, formError, addStep,
    steps, removeStep, moveStep, clearSteps: () => setSteps([]), run,
    preview, previewError, previewing,
  }
}

export type DataTools = ReturnType<typeof useDataTools>
