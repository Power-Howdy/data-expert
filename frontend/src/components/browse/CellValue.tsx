const MAX_CHARS = 160

export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">NULL</span>
  }
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  const short = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text
  return (
    <span
      title={text.length > MAX_CHARS ? text.slice(0, 2000) : undefined}
      className={typeof value === "object" ? "block max-w-[420px] truncate font-mono text-xs text-muted-foreground" : "block max-w-[420px] truncate"}
    >
      {short}
    </span>
  )
}
