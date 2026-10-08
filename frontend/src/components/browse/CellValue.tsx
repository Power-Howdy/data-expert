export function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">NULL</span>
  }
  if (typeof value === "object") {
    return <pre className="text-xs text-muted-foreground">{JSON.stringify(value)}</pre>
  }
  return <span>{String(value)}</span>
}
