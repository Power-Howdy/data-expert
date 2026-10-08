import { Database } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { EmptyState } from "@/components/common/EmptyState"
import { DirectoryNode } from "@/types"
import { DirectoryTreeNode } from "./DirectoryTreeNode"

interface DirectoryTreeViewProps {
  tree: DirectoryNode | null
  selectedPath: string
  onSelectFile: (file: DirectoryNode) => void
}

export function DirectoryTreeView({ tree, selectedPath, onSelectFile }: DirectoryTreeViewProps) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <ScrollArea className="h-full px-2 py-3">
        {tree ? (
          <div className="space-y-0.5">
            <div className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {tree.name}
            </div>
            {tree.children?.map((child) => (
              <DirectoryTreeNode
                key={child.path}
                node={child}
                onSelect={onSelectFile}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            className="min-h-[180px] p-4"
            icon={<Database className="h-8 w-8" />}
            title="No folder yet"
          >
            Click Choose folder to start exploring your datasets
          </EmptyState>
        )}
      </ScrollArea>
    </div>
  )
}
