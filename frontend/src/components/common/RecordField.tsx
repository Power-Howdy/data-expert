interface RecordFieldProps {
  name: string
  type?: string
  value: unknown
}

function formatValue(value: unknown): string {
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

export function RecordField({ name, type, value }: RecordFieldProps) {
  const isNull = value === null || value === undefined
  const isStructured = !isNull && typeof value === "object"

  return (
    <div className="rounded-xl border-2 border-border bg-background/60">
      <div className="flex items-baseline gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-extrabold">{name}</span>
        {type && <span className="text-[10px] font-semibold lowercase text-muted-foreground/70">{type}</span>}
      </div>
      <div className="px-3 py-2.5">
        {isNull ? (
          <span className="text-sm font-semibold text-muted-foreground">NULL</span>
        ) : (
          <pre
            className={
              isStructured
                ? "max-h-96 overflow-auto whitespace-pre font-mono text-xs"
                : "whitespace-pre-wrap break-words font-sans text-sm font-medium leading-relaxed"
            }
          >
            {formatValue(value)}
          </pre>
        )}
      </div>
    </div>
  )
}
