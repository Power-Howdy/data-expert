import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"

export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t-2 border-border bg-muted/40 px-4 py-3">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
