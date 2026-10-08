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
        const total = matrix[row]?.[row] ?? 0
        const ratio = total > 0 ? value / total : 0
        return {
          label: `${(ratio * 100).toFixed(1)}%`,
          color: `rgba(239, 68, 68, ${ratio * 0.5})`,
        }
      }}
    />
  )
}
