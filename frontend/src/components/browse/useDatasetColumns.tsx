import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Dataset, RowData } from "@/types"
import { CellValue } from "./CellValue"
import { ColumnHeader } from "./ColumnHeader"

export function useDatasetColumns(dataset: Dataset | undefined): ColumnDef<RowData>[] {
  return React.useMemo(() => {
    if (!dataset) return []
    return dataset.schema.map((col) => ({
      accessorKey: col.name,
      header: () => <ColumnHeader column={col} />,
      cell: ({ getValue }) => <CellValue value={getValue()} />,
    }))
  }, [dataset])
}
