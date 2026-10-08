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
import { useUIStore } from "@/stores/useStore"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
    <div className="flex-1 ml-0 transition-all duration-200 lg:ml-64">
      <Header />
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <Tabs value={activeTab} onValueChange={(v) => useUIStore.getState().setActiveTab(v)} className="h-full">
          <TabsList className="hidden lg:grid lg:grid-cols-4">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="combine">Combine</TabsTrigger>
          </TabsList>
          <TabsContent value="browse" className="h-full">
            <BrowseTab />
          </TabsContent>
          <TabsContent value="analytics" className="h-full">
            <AnalyticsTab />
          </TabsContent>
          <TabsContent value="export" className="h-full">
            <ExportTab />
          </TabsContent>
          <TabsContent value="combine" className="h-full">
            <CombineTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function App() {
  const { theme } = useUIStore()

  React.useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      <div className={cn("min-h-screen bg-background font-sans antialiased", theme === "dark" && "dark")}>
        <Sidebar />
        <MainContent />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
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