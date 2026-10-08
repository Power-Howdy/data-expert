import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SimpleBarChart, histogramToData } from "@/components/common/SimpleBarChart"
import { cn, formatNumber, formatPercent } from "@/lib/utils"
import { ColumnProfile } from "@/types"
import { ColumnSummary } from "./ColumnSummary"
import { TopValuesList } from "./TopValuesList"

interface ColumnProfileCardProps {
  column: ColumnProfile
  onClick: () => void
  active: boolean
}

export function ColumnProfileCard({ column, onClick, active }: ColumnProfileCardProps) {
  const hasTopValues = column.top_values && column.top_values.length > 0
  return (
    <Card className={cn("cursor-pointer transition-all", active && "ring-2 ring-primary")} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{column.name}</h4>
              <Badge variant="outline" className="text-xs">{column.type}</Badge>
              {column.null_percentage > 0 && (
                <Badge variant="secondary" className="text-xs">{formatPercent(column.null_percentage)} null</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {formatNumber(column.unique_count)} unique · {formatPercent(column.unique_percentage)} unique
            </p>
          </div>
          <ColumnSummary column={column} />
        </div>
        {column.histogram && (
          <div className="mt-3 h-20">
            <SimpleBarChart data={histogramToData(column.histogram.bins, column.histogram.bin_edges)} xKey="range" />
          </div>
        )}
        {hasTopValues && !column.histogram && <TopValuesList values={column.top_values!} />}
      </CardContent>
    </Card>
  )
}
