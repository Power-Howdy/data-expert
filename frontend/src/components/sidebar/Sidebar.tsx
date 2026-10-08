import { PanelLeftClose, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CollapsibleSection } from "@/components/common/CollapsibleSection"
import { useIndexingPoll } from "@/hooks/useIndexingPoll"
import { FolderPicker } from "./FolderPicker"
import { DirectoryTreeView } from "./DirectoryTreeView"
import { LoadedDatasetsList } from "./LoadedDatasetsList"
import { useSidebar } from "./useSidebar"

export function Sidebar() {
  const { store, loading, pickFolder, scanPath, loadDataset } = useSidebar()
  const indexing = useIndexingPoll()
  const folderName = store.currentDirectory.split(/[\\/]/).filter(Boolean).pop()

  if (!store.sidebarOpen) return null

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r-2 border-border bg-sidebar"
      style={{ width: store.sidebarWidth }}
    >
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-4 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-duo-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black leading-tight">Data Expert</h2>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
              Learn your data
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => store.setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="h-5 w-5" />
        </Button>
      </div>

      <CollapsibleSection
        title="Data folder"
        open={!store.folderCollapsed}
        onToggle={() => store.setFolderCollapsed(!store.folderCollapsed)}
        summary={folderName}
        className={store.folderCollapsed ? undefined : "border-b-0"}
      >
        <FolderPicker
          path={store.currentDirectory}
          loading={loading}
          onPick={pickFolder}
          onRefresh={() => scanPath(store.currentDirectory)}
        />
        <DirectoryTreeView
          tree={store.directoryTree}
          selectedPath={store.currentDirectory}
          onSelectFile={loadDataset}
        />
      </CollapsibleSection>

      <LoadedDatasetsList
        datasets={store.datasets}
        selectedId={store.selectedDatasetId}
        onSelect={store.selectDataset}
        indexing={indexing}
        grow={store.folderCollapsed}
      />
    </aside>
  )
}
