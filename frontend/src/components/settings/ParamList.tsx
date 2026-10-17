import type { FunctionParam } from "@/types/ai"

function typeLabel(p: FunctionParam) {
  return p.options.length ? `${p.type}: ${p.options.join(" | ")}` : p.type
}

export function ParamList({ params }: { params: FunctionParam[] }) {
  if (!params.length) return <p className="text-xs text-muted-foreground">No parameters</p>
  return (
    <ul className="space-y-1.5">
      {params.map((p) => (
        <li key={p.name} className="text-xs">
          <span className="font-mono font-bold text-foreground">{p.name}</span>
          <span className="ml-2 break-words font-mono text-muted-foreground">{typeLabel(p)}</span>
          {!p.required && (
            <span className="ml-2 text-muted-foreground">
              {p.default !== undefined && p.default !== null ? `default ${JSON.stringify(p.default)}` : "optional"}
            </span>
          )}
          {p.description && <span className="block text-muted-foreground">{p.description}</span>}
        </li>
      ))}
    </ul>
  )
}
