import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { ColumnSchema, RowData } from "@/types"
import { RecordDrawer } from "./RecordDrawer"

interface BrowseTableProps {
  columns: ColumnDef<RowData>[]
  rows: RowData[]
  schema: ColumnSchema[]
  loading?: boolean
  rowOffset?: number
}

export function BrowseTable({ columns, rows, schema, loading, rowOffset = 0 }: BrowseTableProps) {
  const [selected, setSelected] = React.useState<RowData | null>(null)
  const closeDrawer = React.useCallback(() => setSelected(null), [])
  const index = selected ? rows.indexOf(selected) : -1

  return (
    <>
      <DataTable
        className="h-full"
        columns={columns}
        data={rows}
        paginate={false}
        emptyText={loading ? "Loading rows..." : "No rows"}
        onRowClick={setSelected}
      />
      {selected && (
        <RecordDrawer
          record={selected}
          schema={schema}
          title={index >= 0 ? `Row ${(rowOffset + index + 1).toLocaleString()}` : "Record"}
          onClose={closeDrawer}
        />
      )}
    </>
  )
}
