import { AlertTriangle, BarChart, Database, TrendingUp } from "lucide-react"
import { StatCard } from "@/components/common/StatCard"
import { formatBytes, formatNumber, formatPercent } from "@/lib/utils"
import { AnalyticsOverview } from "@/types"

export function OverviewStats({ overview }: { overview: AnalyticsOverview }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Rows" value={formatNumber(overview.row_count)} icon={<Database className="h-5 w-5" />} />
      <StatCard title="Columns" value={String(overview.column_count)} icon={<BarChart className="h-5 w-5" />} />
      <StatCard title="Memory" value={formatBytes(overview.memory_bytes)} icon={<TrendingUp className="h-5 w-5" />} />
      <StatCard
        title="Missing %" icon={<AlertTriangle className="h-5 w-5" />}
        value={overview.missing_percentage == null ? "—" : formatPercent(overview.missing_percentage)}
      />
    </div>
  )
}
