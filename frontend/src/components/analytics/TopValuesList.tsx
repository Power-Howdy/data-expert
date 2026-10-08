import { formatNumber } from "@/lib/utils"

interface TopValuesListProps {
  values: Array<{ value: any; count: number }>
  limit?: number
}

export function TopValuesList({ values, limit = 5 }: TopValuesListProps) {
  return (
    <div className="mt-3 space-y-1">
      {values.slice(0, limit).map((tv, i) => (
        <div key={i} className="flex items-start justify-between gap-3 text-sm">
          <span className="line-clamp-2 min-w-0 flex-1 break-words" title={String(tv.value)}>
            {String(tv.value)}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(tv.count)}</span>
        </div>
      ))}
    </div>
  )
}
