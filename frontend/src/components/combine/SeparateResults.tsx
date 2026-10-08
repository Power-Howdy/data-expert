import { Database, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/common/SectionCard"
import { formatNumber } from "@/lib/utils"
import { Dataset } from "@/types"

export function SeparateResults({ datasets }: { datasets: Dataset[] }) {
  return (
    <SectionCard
      title={`Separated into ${datasets.length} datasets`}
      icon={<Download className="h-5 w-5" />}
      className="border-green-500"
      titleClassName="text-green-600"
    >
      <div className="space-y-2">
        {datasets.map((ds) => (
          <div key={ds.id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5" />
              <div>
                <p className="font-medium">{ds.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(ds.row_count)} rows · {ds.format}
                </p>
              </div>
            </div>
            <Badge variant="outline">{ds.path}</Badge>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
