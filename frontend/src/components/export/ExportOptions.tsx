import { Settings } from "lucide-react"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import { SectionCard } from "@/components/common/SectionCard"
import { SelectOption, SimpleSelect } from "@/components/common/SimpleSelect"

// Radix Select forbids empty-string item values, so "no selection" uses a sentinel.
const NONE = "__none__"

const compressionOptions: SelectOption[] = [
  { value: NONE, label: "None" },
  { value: "gzip", label: "GZIP" },
  { value: "zstd", label: "ZSTD" },
  { value: "snappy", label: "Snappy" },
]

interface ExportOptionsProps {
  columns: string[]
  compression: string
  onCompressionChange: (value: string) => void
  partitionBy: string
  onPartitionByChange: (value: string) => void
  outputPath: string
  onOutputPathChange: (value: string) => void
}

const fromSelect = (v: string) => (v === NONE ? "" : v)

export function ExportOptions(props: ExportOptionsProps) {
  const partitionOptions: SelectOption[] = [
    { value: NONE, label: "No partitioning" },
    ...props.columns.map((c) => ({ value: c, label: c })),
  ]
  return (
    <SectionCard title="Options" icon={<Settings className="h-5 w-5" />} contentClassName="space-y-4">
      <FormField label="Compression">
        <SimpleSelect
          value={props.compression || NONE}
          onChange={(v) => props.onCompressionChange(fromSelect(v))}
          options={compressionOptions}
        />
      </FormField>
      <FormField label="Partition By Column" hint="Only available for Parquet format">
        <SimpleSelect
          value={props.partitionBy || NONE}
          onChange={(v) => props.onPartitionByChange(fromSelect(v))}
          options={partitionOptions}
        />
      </FormField>
      <FormField label="Output Path (optional)">
        <Input
          value={props.outputPath}
          onChange={(e) => props.onOutputPathChange(e.target.value)}
          placeholder="Leave empty for auto-generated path"
        />
      </FormField>
    </SectionCard>
  )
}
