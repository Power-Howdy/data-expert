"use client"
import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "react-hot-toast"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { Header } from "@/components/Header"
import { BrowseTab } from "@/components/browse/BrowseTab"
import { AnalyticsTab } from "@/components/analytics/AnalyticsTab"
import { ExportTab } from "@/components/export/ExportTab"
import { CombineTab } from "@/components/combine/CombineTab"
import { HistoryTab } from "@/components/history/HistoryTab"
import { AISettingsPanel } from "@/components/settings/AISettingsPanel"
import { useUIStore } from "@/stores/useStore"
import { useAIStore } from "@/stores/useAIStore"
import { cn } from "@/lib/utils"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function MainContent() {
  const { activeTab } = useUIStore()

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Header />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto h-full max-w-7xl">
          {activeTab === "browse" && <BrowseTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "history" && <HistoryTab />}
          {activeTab === "export" && <ExportTab />}
          {activeTab === "combine" && <CombineTab />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const { theme } = useUIStore()
  const { settingsOpen, load: loadAISettings } = useAIStore()

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])

  React.useEffect(() => {
    loadAISettings()
  }, [loadAISettings])

  return (
    <QueryClientProvider client={queryClient}>
      <div className={cn("flex h-screen overflow-hidden font-sans", theme === "dark" && "dark")}>
        <Sidebar />
        <MainContent />
        {settingsOpen && <AISettingsPanel />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            className: "font-sans font-bold",
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "2px solid hsl(var(--border))",
              borderRadius: "1rem",
              fontWeight: 700,
            },
            success: {
              iconTheme: {
                primary: "hsl(var(--primary))",
                secondary: "hsl(var(--primary-foreground))",
              },
            },
            error: {
              iconTheme: {
                primary: "hsl(var(--destructive))",
                secondary: "hsl(var(--destructive-foreground))",
              },
            },
          }}
        />
      </div>
    </QueryClientProvider>
  )
}
