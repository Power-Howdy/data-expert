import { SelectOption } from "@/components/common/SimpleSelect"
import { Dataset, DataFormat } from "@/types"

export type CombineStrategy = "concat" | "join" | "merge"

export interface JoinConfig {
  leftOn: string
  rightOn: string
  how: string
}

const strategies = [
  { value: "concat", label: "Concatenate (Vertical)", description: "Stack datasets vertically, aligning columns by name" },
  { value: "join", label: "Join (Horizontal)", description: "Join datasets on common keys (requires 2 datasets)" },
  { value: "merge", label: "Merge (Outer Join)", description: "Merge all datasets on common keys with coalesce" },
]

export const strategyOptions: SelectOption[] = strategies.map((s) => ({
  value: s.value,
  label: (
    <div>
      <p className="font-medium">{s.label}</p>
      <p className="text-xs text-muted-foreground">{s.description}</p>
    </div>
  ),
}))

export const joinTypeOptions: SelectOption[] = [
  { value: "inner", label: "Inner Join" },
  { value: "left", label: "Left Join" },
  { value: "right", label: "Right Join" },
  { value: "outer", label: "Full Outer Join" },
]

export const outputFormatOptions: SelectOption[] = (["parquet", "csv", "json", "jsonl", "feather"] as DataFormat[])
  .map((f) => ({ value: f, label: f.toUpperCase() }))

export function getCommonColumns(datasets: Dataset[], selectedIds: string[]) {
  const selected = datasets.filter((d) => selectedIds.includes(d.id))
  if (selected.length < 2) return []
  const cols2 = new Set(selected[1].schema.map((c) => c.name))
  return selected[0].schema.map((c) => c.name).filter((c) => cols2.has(c))
}
