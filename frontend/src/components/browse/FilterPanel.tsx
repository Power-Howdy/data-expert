import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ColumnFilter } from "./filterOperators"
import { FilterRow } from "./FilterRow"

interface FilterPanelProps {
  filters: ColumnFilter[]
  columns: string[]
  onChange: (filters: ColumnFilter[]) => void
}

export function FilterPanel({ filters, columns, onChange }: FilterPanelProps) {
  const addFilter = () => {
    onChange([...filters, { column: columns[0] || "", operator: "eq", value: "" }])
  }

  const updateFilter = (index: number, field: keyof ColumnFilter, value: string) => {
    onChange(filters.map((f, i) => (i === index ? { ...f, [field]: value } : f)))
  }

  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Filters</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {filters.map((filter, index) => (
            <FilterRow
              key={index}
              filter={filter}
              columns={columns}
              onChange={(field, value) => updateFilter(index, field, value)}
              onRemove={() => onChange(filters.filter((_, i) => i !== index))}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addFilter}>
            <Plus className="h-4 w-4 mr-2" />
            Add Filter
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
