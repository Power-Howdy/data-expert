import { ScrollArea } from "@/components/ui/scroll-area"
import { DirectoryNode } from "@/types"
import { DirectoryTreeNode } from "./DirectoryTreeNode"

interface DirectoryTreeViewProps {
  tree: DirectoryNode | null
  selectedPath: string
  onSelectFile: (file: DirectoryNode) => void
}

export function DirectoryTreeView({ tree, selectedPath, onSelectFile }: DirectoryTreeViewProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full p-2">
        {tree ? (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">{tree.name}</div>
            {tree.children?.map((child) => (
              <DirectoryTreeNode key={child.path} node={child} onSelect={onSelectFile} selectedPath={selectedPath} />
            ))}
          </>
        ) : (
          <div className="text-center text-muted-foreground py-8">Enter a directory path to browse files</div>
        )}
      </ScrollArea>
    </div>
  )
}
