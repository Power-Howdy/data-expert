const MAX_SHOWN = 50

export function OutliersList({ outliers }: { outliers: any }) {
  const values: any[] = outliers.outliers
  return (
    <div>
      <h4 className="font-medium mb-2">Outliers ({outliers.count} found)</h4>
      <p className="text-sm text-muted-foreground mb-2">
        Method: {outliers.method} (threshold: {outliers.threshold})
      </p>
      <div className="max-h-40 overflow-auto text-sm font-mono">
        {values.slice(0, MAX_SHOWN).map((v, i) => (
          <div key={i}>{v}</div>
        ))}
        {values.length > MAX_SHOWN && (
          <div className="text-muted-foreground">... and {values.length - MAX_SHOWN} more</div>
        )}
      </div>
    </div>
  )
}
