import { Settings2, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { LoadingButton } from "@/components/common/LoadingButton"
import { SectionCard } from "@/components/common/SectionCard"
import { JobProgress } from "./JobProgress"
import { useAIConfigured, useAIStore } from "@/stores/useAIStore"
import type { AITransform } from "./useAITransform"
import { SamplePrompts } from "./SamplePrompts"
import { PlanPreview } from "./PlanPreview"

export function AIAssistant({ ai }: { ai: AITransform }) {
  const configured = useAIConfigured()
  const openSettings = useAIStore((s) => s.openSettings)
  const busy = ai.planning || ai.running

  const settingsButton = (
    <Button variant="ghost" size="sm" onClick={openSettings}>
      <Settings2 className="h-4 w-4" /> AI settings
    </Button>
  )

  return (
    <SectionCard title="Transform with AI" icon={<Wand2 className="h-4 w-4" />} actions={settingsButton} contentClassName="space-y-4">
      {!configured && (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-400">
          AI is not configured yet. Open AI settings to choose a provider and model.
        </p>
      )}
      <p className="text-xs font-semibold text-muted-foreground">
        {ai.view ? "Prompts now refine the current result." : "Describe what you want; you'll review the plan before anything runs."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <Textarea
          rows={2}
          value={ai.prompt}
          placeholder="e.g. Extract the email addresses from the text"
          onChange={(e) => ai.setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && ai.makePlan()}
          disabled={busy}
        />
        <LoadingButton
          className="shrink-0"
          onClick={() => ai.makePlan()}
          loading={ai.planning}
          loadingText="Planning..."
          disabled={!configured || ai.running || !ai.prompt.trim()}
        >
          <Wand2 className="h-4 w-4" /> Plan
        </LoadingButton>
      </div>
      {!ai.plan && !ai.running && <SamplePrompts onPick={(p) => ai.makePlan(p)} disabled={!configured || busy} />}
      {ai.plan && (
        <PlanPreview plan={ai.plan} onRun={ai.run} onDismiss={() => ai.setPlan(null)} running={ai.running} />
      )}
      {ai.running && ai.job && <JobProgress job={ai.job} onCancel={ai.cancel} />}
    </SectionCard>
  )
}
