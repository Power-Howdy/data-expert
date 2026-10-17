import { Search } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { SectionCard } from "@/components/common/SectionCard"

export function PreviewCard({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Object.keys(rows[0] || {}).map((col) => ({ accessorKey: col, header: col }))
  return (
    <SectionCard
      title={`Preview (${rows.length} rows)`}
      icon={<Search className="h-5 w-5" />}
      className="border-primary"
    >
      <DataTable columns={columns} data={rows} pageSize={10} />
    </SectionCard>
  )
}
