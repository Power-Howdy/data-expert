import { BookOpen, ExternalLink, ShieldCheck } from "lucide-react"
import { useBackendHealth } from "@/hooks/useBackendHealth"
import { useUIStore } from "@/stores/useStore"
import { cn } from "@/lib/utils"

const API_DOCS_URL = `${window.location.protocol}//${window.location.hostname}:8000/docs`

export function AppFooter() {
  const { online, version } = useBackendHealth()
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const link = "inline-flex items-center gap-1 hover:text-foreground"

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-border bg-card/90 px-4 py-2 text-xs font-bold text-muted-foreground lg:px-6">
      <span>Data Expert{version && ` v${version}`}</span>
      <span className="hidden items-center gap-1 md:inline-flex">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Your data stays on this computer
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5" title={online ? "Backend is running" : "Backend is not reachable"}>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            online === null ? "bg-muted-foreground" : online ? "bg-primary" : "bg-destructive animate-pulse"
          )}
        />
        {online === null ? "Connecting…" : online ? "Connected" : "Backend offline"}
      </span>
      <button type="button" className={link} onClick={() => setActiveTab("guide")}>
        <BookOpen className="h-3.5 w-3.5" /> User guide
      </button>
      <a className={link} href={API_DOCS_URL} target="_blank" rel="noreferrer">
        <ExternalLink className="h-3.5 w-3.5" /> API docs
      </a>
    </footer>
  )
}
