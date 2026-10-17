import { flexRender, Header } from "@tanstack/react-table"
import { ChevronDown, ChevronsUpDown, ChevronUp, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

function SortIcon({ sorted, canSort }: { sorted: false | "asc" | "desc"; canSort: boolean }) {
  if (sorted === "asc") return <ChevronUp className="h-3.5 w-3.5 text-primary" />
  if (sorted === "desc") return <ChevronDown className="h-3.5 w-3.5 text-primary" />
  return canSort
    ? <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
    : null
}

export function DataTableHeaderCell<TData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header
  return (
    <th className="group h-10 whitespace-nowrap bg-muted px-3.5 text-left align-middle text-xs font-bold text-muted-foreground">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Column options"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
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
