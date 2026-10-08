import { HeatmapTable } from "@/components/common/HeatmapTable"

interface CorrelationHeatmapProps {
  correlations: Record<string, Record<string, number>>
  columns: string[]
}

export function CorrelationHeatmap({ correlations, columns }: CorrelationHeatmapProps) {
  return (
    <HeatmapTable
      columns={columns}
      getCell={(row, col) => {
        const value = correlations[row]?.[col] ?? 0
        const alpha = Math.abs(value) * 0.5
        return {
          label: value.toFixed(2),
          color: value > 0 ? `rgba(59, 130, 246, ${alpha})` : `rgba(239, 68, 68, ${alpha})`,
        }
      }}
    />
  )
}
