import { flexRender, Header } from "@tanstack/react-table"
import { ChevronDown, ChevronsUpDown, ChevronUp, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

function SortIcon({ sorted, canSort }: { sorted: false | "asc" | "desc"; canSort: boolean }) {
  if (sorted === "asc") return <ChevronUp className="h-4 w-4" />
  if (sorted === "desc") return <ChevronDown className="h-4 w-4" />
  return canSort ? <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" /> : null
}

export function DataTableHeaderCell<TData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header
  return (
    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0">
      {!header.isPlaceholder && (
        <div
          className={cn("flex items-center space-x-2", column.getCanSort() ? "cursor-pointer select-none" : "cursor-default")}
          onClick={column.getToggleSortingHandler()}
        >
          {flexRender(column.columnDef.header, header.getContext())}
          <SortIcon sorted={column.getIsSorted()} canSort={column.getCanSort()} />
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Column options">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={column.getToggleVisibilityHandler()}>
            {column.getIsVisible() ? "Hide" : "Show"} Column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </th>
  )
}
