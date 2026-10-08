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
    <SectionCard title="Output Format" icon={<Download className="h-5 w-5" />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {formats.map((fmt) => (
          <button
            key={fmt.format}
            onClick={() => onSelect(fmt.format)}
            className={cn(
              "p-4 rounded-lg border-2 transition-all text-left",
              selected === fmt.format ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {formatIcons[fmt.format]}
              <span className="font-medium">{fmt.name}</span>
            </div>
            <p className="text-sm text-muted-foreground">{fmt.description}</p>
            <div className="flex gap-1 mt-2">
              {fmt.supports_compression && <Badge variant="secondary" className="text-xs">Compression</Badge>}
              {fmt.supports_partitioning && <Badge variant="outline" className="text-xs">Partitioning</Badge>}
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  )
}
