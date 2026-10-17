import * as React from "react"
import { CheckCircle2, XCircle } from "lucide-react"
import { LoadingButton } from "@/components/common/LoadingButton"
import { aiApi } from "@/lib/aiApi"
import type { AIProvider, ProviderTestResult } from "@/types/ai"

export function ConnectionTest({ provider }: { provider: AIProvider }) {
  const [testing, setTesting] = React.useState(false)
  const [result, setResult] = React.useState<ProviderTestResult | null>(null)

  React.useEffect(() => setResult(null), [provider.id, provider.base_url, provider.model])

  const run = async () => {
    setTesting(true)
    try {
      setResult(await aiApi.testProvider(provider))
    } catch {
      setResult(null)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <LoadingButton variant="sky" size="sm" onClick={run} loading={testing} loadingText="Testing..." disabled={!provider.model}>
        Test connection
      </LoadingButton>
      {!provider.model && <span className="text-xs font-semibold text-muted-foreground">Pick a model on the Model tab first</span>}
      {result?.ok && (
        <span className="flex items-center gap-1 text-xs font-bold text-primary">
          <CheckCircle2 className="h-4 w-4" /> Connected · {result.latency_ms} ms · “{result.reply}”
        </span>
      )}
      {result && !result.ok && (
        <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-destructive">
          <XCircle className="h-4 w-4 shrink-0" /> <span className="break-words">{result.error}</span>
        </span>
      )}
    </div>
  )
}
