"use client"
import * as React from "react"
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  RowSelectionState,
} from "@tanstack/react-table"
import { DataTableHeaderCell } from "./data-table-header-cell"
import { DataTableBody } from "./data-table-body"
import { DataTablePagination } from "./data-table-pagination"
import { cn } from "@/lib/utils"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  paginate?: boolean
  emptyText?: string
  className?: string
  onRowClick?: (row: TData) => void
  onSelectionChange?: (rows: TData[]) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 50,
  paginate = true,
  emptyText,
  className,
  onRowClick,
  onSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize })
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, pagination, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  })

  React.useEffect(() => {
    setPagination({ pageIndex: 0, pageSize })
  }, [pageSize, data])

  React.useEffect(() => {
    onSelectionChange?.(table.getSelectedRowModel().rows.map((r) => r.original))
  }, [rowSelection, table, onSelectionChange])

  return (
    <div className={cn("flex w-full flex-col overflow-hidden rounded-2xl border-2 border-border bg-card", className)}>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-10 bg-muted [&_th]:shadow-[inset_0_-2px_0_hsl(var(--border))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <DataTableHeaderCell key={header.id} header={header} />
                ))}
              </tr>
            ))}
          </thead>
          <DataTableBody table={table} columnCount={columns.length} onRowClick={onRowClick} emptyText={emptyText} />
        </table>
      </div>
      {paginate && <DataTablePagination table={table} />}
    </div>
  )
}
