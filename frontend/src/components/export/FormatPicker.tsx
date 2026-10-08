import { Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/common/SectionCard"
import { cn } from "@/lib/utils"
import { DataFormat } from "@/types"
import { ExportFormatInfo, formatIcons } from "./formatIcons"

interface FormatPickerProps {
  formats: ExportFormatInfo[]
  selected: DataFormat
  onSelect: (format: DataFormat) => void
}

export function FormatPicker({ formats, selected, onSelect }: FormatPickerProps) {
  return (
    <SectionCard title="Output Format" icon={<Download className="h-4 w-4" />}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {formats.map((fmt) => (
          <button
            key={fmt.format}
            type="button"
            onClick={() => onSelect(fmt.format)}
            className={cn(
              "rounded-2xl border-2 p-4 text-left transition-all",
              selected === fmt.format
                ? "border-primary bg-primary/10 shadow-duo-primary"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-primary">{formatIcons[fmt.format]}</span>
              <span className="font-extrabold">{fmt.name}</span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{fmt.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {fmt.supports_compression && <Badge variant="sky">Compression</Badge>}
              {fmt.supports_partitioning && <Badge variant="outline">Partitioning</Badge>}
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  )
}
