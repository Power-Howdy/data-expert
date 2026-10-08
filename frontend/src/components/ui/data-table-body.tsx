import { flexRender, Table } from "@tanstack/react-table"
import { cn } from "@/lib/utils"

interface DataTableBodyProps<TData> {
  table: Table<TData>
  columnCount: number
  onRowClick?: (row: TData) => void
}

export function DataTableBody<TData>({ table, columnCount, onRowClick }: DataTableBodyProps<TData>) {
  const rows = table.getRowModel().rows
  const selection = table.getState().rowSelection
  return (
    <tbody className="[&_tr:last-child]:border-0">
      {rows.length ? (
        rows.map((row) => (
          <tr
            key={row.id}
            className={cn(
              "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
              onRowClick && "cursor-pointer"
            )}
            onClick={() => onRowClick?.(row.original)}
            style={{ backgroundColor: selection[row.id] ? "hsl(var(--muted))" : undefined }}
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="p-4 align-middle">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={columnCount} className="h-24 text-center text-muted-foreground">No data</td>
        </tr>
      )}
    </tbody>
  )
}
