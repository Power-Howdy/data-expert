import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAIStore } from "@/stores/useAIStore"
import { cn } from "@/lib/utils"

export function AISettingsButton() {
  const { settings, openSettings } = useAIStore()
  const provider = settings?.providers.find((p) => p.id === settings.active_provider_id)
  const label = settings?.configured ? `${provider?.name} · ${provider?.model}` : "AI not configured"

  return (
    <Button variant="ghost" size="sm" onClick={openSettings} title={label} aria-label="AI settings" className="relative">
      <Sparkles className="h-5 w-5" />
      <span className="hidden max-w-[180px] truncate normal-case tracking-normal xl:inline">{label}</span>
      <span
        className={cn(
          "absolute right-1 top-1 h-2 w-2 rounded-full",
          settings?.configured ? "bg-primary" : "bg-amber-500"
        )}
      />
    </Button>
  )
}
