import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { ColumnSchema, RowData } from "@/types"
import { CellValue } from "./CellValue"
import { ColumnHeader } from "./ColumnHeader"

export function useDatasetColumns(schema: ColumnSchema[] | undefined): ColumnDef<RowData>[] {
  return React.useMemo(() => {
    if (!schema) return []
    return schema.map((col) => ({
      id: col.name,
      accessorFn: (row: RowData) => row.data?.[col.name],
      header: () => <ColumnHeader column={col} />,
      cell: ({ getValue }) => <CellValue value={getValue()} />,
    }))
  }, [schema])
}
