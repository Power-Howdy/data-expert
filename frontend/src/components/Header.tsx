"use client"
import { BarChart3, HelpCircle, Combine, Download, GitBranch, Moon, PanelLeft, Sun, Table2 } from "lucide-react"
import { useDatasetStore, useUIStore } from "@/stores/useStore"
import { Button } from "@/components/ui/button"
import { AISettingsButton } from "@/components/settings/AISettingsButton"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "browse", label: "Browse", icon: Table2 },
  { id: "analytics", label: "Stats", icon: BarChart3 },
  { id: "history", label: "History", icon: GitBranch },
  { id: "export", label: "Export", icon: Download },
  { id: "combine", label: "Combine", icon: Combine },
] as const

export function Header() {
  const { theme, toggleTheme, activeTab, setActiveTab } = useUIStore()
  const { sidebarOpen, setSidebarOpen } = useDatasetStore()

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-card/90 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        {!sidebarOpen && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="shrink-0"
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        )}

        <nav className="flex min-w-0 flex-1 items-center gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "duo-nav-pill inline-flex shrink-0 items-center gap-2 px-3 xl:px-4",
                activeTab === id
                  ? "bg-primary text-primary-foreground shadow-duo-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>

        <Button
          variant="ghost" size="icon" onClick={() => setActiveTab("guide")} aria-label="User guide" title="User guide"
          className={cn(activeTab === "guide" && "bg-muted text-foreground")}
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
        <AISettingsButton />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  )
}
