import { HeatmapTable } from "@/components/common/HeatmapTable"

interface MissingMatrixProps {
  matrix: Record<string, Record<string, number>>
  columns: string[]
}

export function MissingMatrix({ matrix, columns }: MissingMatrixProps) {
  return (
    <HeatmapTable
      columns={columns}
      getCell={(row, col) => {
        const value = matrix[row]?.[col] ?? 0
        const total = matrix[row]?.[row] ?? 1
        return {
          label: `${((value / total) * 100).toFixed(1)}%`,
          color: `rgba(239, 68, 68, ${(value / total) * 0.5})`,
        }
      }}
    />
  )
}
