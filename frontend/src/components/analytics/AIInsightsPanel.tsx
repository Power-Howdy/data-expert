import { Settings2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingButton } from "@/components/common/LoadingButton"
import { Markdown } from "@/components/common/Markdown"
import { useAIConfigured, useAIStore } from "@/stores/useAIStore"
import { useAIInsights } from "./useAIInsights"

export function AIInsightsPanel({ datasetId }: { datasetId: string }) {
  const configured = useAIConfigured()
  const openSettings = useAIStore((s) => s.openSettings)
  const { insights, focus, setFocus, generating, generate } = useAIInsights(datasetId)

  return (
    <div className="space-y-4 p-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={focus}
          placeholder="Optional focus, e.g. data quality, outliers in token_count, topics"
          onChange={(e) => setFocus(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && configured && !generating && generate()}
          disabled={generating}
        />
        {configured ? (
          <LoadingButton className="shrink-0" onClick={generate} loading={generating} loadingText="Analysing...">
            <Sparkles className="h-4 w-4" /> {insights ? "Regenerate insights" : "Generate insights"}
          </LoadingButton>
        ) : (
          <Button variant="outline" className="shrink-0" onClick={openSettings}>
            <Settings2 className="h-4 w-4" /> Configure AI
          </Button>
        )}
      </div>
      {insights ? (
        <div className="rounded-2xl border-2 border-border bg-card p-5">
          <Markdown source={insights.markdown} />
          <p className="mt-4 border-t-2 border-border pt-3 text-xs font-bold text-muted-foreground">
            Generated {new Date(insights.generated_at).toLocaleString()}
            {insights.model && ` · ${insights.model}`}
            {insights.focus && ` · focus: ${insights.focus}`}
          </p>
        </div>
      ) : (
        <EmptyState icon={<Sparkles className="h-9 w-9" />} title="No insights yet">
          {generating
            ? "The model is reading the profile; this can take a minute with local models."
            : "Generate a summary of this dataset from its profile: key findings, data quality and next steps."}
        </EmptyState>
      )}
    </div>
  )
}
