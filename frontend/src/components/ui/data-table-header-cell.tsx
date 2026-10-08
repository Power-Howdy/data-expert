import { flexRender, Header } from "@tanstack/react-table"
import { ChevronDown, ChevronsUpDown, ChevronUp, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

function SortIcon({ sorted, canSort }: { sorted: false | "asc" | "desc"; canSort: boolean }) {
  if (sorted === "asc") return <ChevronUp className="h-4 w-4 text-primary" />
  if (sorted === "desc") return <ChevronDown className="h-4 w-4 text-primary" />
  return canSort ? <ChevronsUpDown className="h-4 w-4 text-muted-foreground/40" /> : null
}

export function DataTableHeaderCell<TData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header
  return (
    <th className="h-12 px-4 text-left align-middle text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
      <div className="flex items-center gap-1">
        {!header.isPlaceholder && (
          <div
            className={cn(
              "flex flex-1 items-center gap-1.5",
              column.getCanSort() ? "cursor-pointer select-none" : "cursor-default"
            )}
            onClick={column.getToggleSortingHandler()}
          >
            {flexRender(column.columnDef.header, header.getContext())}
            <SortIcon sorted={column.getIsSorted()} canSort={column.getCanSort()} />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Column options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={column.getToggleVisibilityHandler()}>
              {column.getIsVisible() ? "Hide" : "Show"} Column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </th>
  )
}
