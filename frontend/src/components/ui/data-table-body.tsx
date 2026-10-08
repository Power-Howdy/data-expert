import { flexRender, Table } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

interface DataTableBodyProps<TData> {
  table: Table<TData>
  columnCount: number
  onRowClick?: (row: TData) => void
  emptyText?: string
}

export function DataTableBody<TData>({ table, columnCount, onRowClick, emptyText = "No data yet" }: DataTableBodyProps<TData>) {
  const rows = table.getRowModel().rows
  const selection = table.getState().rowSelection

  return (
    <tbody>
      {rows.length ? (
        rows.map((row) => (
          <tr
            key={row.id}
            className={cn(
              "border-b border-border transition-colors hover:bg-primary/5",
              onRowClick && "cursor-pointer",
              selection[row.id] && "bg-primary/10"
            )}
            onClick={() => onRowClick?.(row.original)}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="whitespace-nowrap px-3.5 py-3 align-middle text-sm font-semibold">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={columnCount} className="h-28 text-center text-sm font-bold text-muted-foreground">
            {emptyText}
          </td>
        </tr>
      )}
    </tbody>
  )
}
