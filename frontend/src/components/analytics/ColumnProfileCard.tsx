import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn, formatNumber, formatPercent } from "@/lib/utils"
import { ColumnProfile } from "@/types"
import { ColumnChart } from "./ColumnChart"
import { ColumnSummary } from "./ColumnSummary"

interface ColumnProfileCardProps {
  column: ColumnProfile
  onClick: () => void
  active: boolean
}

export function ColumnProfileCard({ column, onClick, active }: ColumnProfileCardProps) {
  return (
    <Card className={cn("min-w-0 cursor-pointer overflow-hidden transition-all", active && "ring-2 ring-primary")} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="break-all font-medium">{column.name}</h4>
              <Badge variant="outline" className="text-xs">{column.type}</Badge>
              {column.null_percentage > 0 && (
                <Badge variant="secondary" className="text-xs">{formatPercent(column.null_percentage)} null</Badge>
              )}
            </div>
            <p className="mt-1 whitespace-nowrap text-sm text-muted-foreground">
              {formatNumber(column.unique_count)} unique · {formatPercent(column.unique_percentage)} unique
            </p>
          </div>
          <ColumnSummary column={column} />
        </div>
        <ColumnChart column={column} />
      </CardContent>
    </Card>
  )
}
