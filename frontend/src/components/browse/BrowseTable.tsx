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
  /** Makes the record drawer editable. */
  datasetId?: string
}

export function BrowseTable({ columns, rows, schema, loading, rowOffset = 0, datasetId }: BrowseTableProps) {
  const [selected, setSelected] = React.useState<RowData | null>(null)
  const closeDrawer = React.useCallback(() => setSelected(null), [])
  const index = selected ? rows.findIndex((row) => row.id === selected.id) : -1

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
          key={selected.id}
          record={selected}
          schema={schema}
          datasetId={datasetId}
          title={index >= 0 ? `Row ${(rowOffset + index + 1).toLocaleString()}` : "Record"}
          onClose={closeDrawer}
        />
      )}
    </>
  )
}
