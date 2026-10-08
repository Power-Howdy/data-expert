interface TopValuesListProps {
  values: Array<{ value: any; count: number }>
  limit?: number
}

export function TopValuesList({ values, limit = 5 }: TopValuesListProps) {
  return (
    <div className="mt-3 space-y-1">
      {values.slice(0, limit).map((tv, i) => (
        <div key={i} className="flex items-center justify-between text-sm">
          <span className="truncate max-w-[200px]">{String(tv.value)}</span>
          <span className="text-muted-foreground">{tv.count}</span>
        </div>
      ))}
    </div>
  )
}
