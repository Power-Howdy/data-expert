import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/common/EmptyState"
import { formatNumber } from "@/lib/utils"
import { ExportHistoryEntry, formatIcons } from "./formatIcons"

export function ExportHistory({ entries }: { entries: ExportHistoryEntry[] }) {
  if (entries.length === 0) return <EmptyState>No export history yet</EmptyState>

  return (
    <div className="p-2 space-y-2">
      {entries.map((exp) => (
        <Card key={exp.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {formatIcons[exp.format]}
                <div>
                  <p className="font-medium">{exp.format.toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(exp.rows)} rows · {new Date(exp.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground truncate max-w-[300px]">{exp.path}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
