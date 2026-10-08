"use client"
import * as React from "react"
import { useUIStore } from "@/stores/useStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Search, Sun, Moon, Settings, Download, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { DataTable } from "@/components/ui/data-table"
import { useDatasetStore } from "@/stores/useStore"
import { api } from "@/lib/api"
import { ColumnDef } from "@tanstack/react-table"
import { RowData, Dataset } from "@/types"
import toast from "react-hot-toast"

export function Header() {
  const { theme, toggleTheme, activeTab, setActiveTab, notifications, removeNotification } = useUIStore()
  const { selectedDatasetId, datasets } = useDatasetStore()
  
  const dataset = datasets.find(d => d.id === selectedDatasetId)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        <div className="flex-1 flex items-center gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 max-w-2xl hidden md:flex">
            <TabsList className="bg-muted p-1 rounded-md">
              <TabsTrigger value="browse">Browse</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="combine">Combine</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Global search..."
              className="pl-8 w-64"
            />
          </div>

          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="icon" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}