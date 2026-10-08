import { Database, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import { LoadingButton } from "@/components/common/LoadingButton"
import { SectionCard } from "@/components/common/SectionCard"
import { SimpleSelect } from "@/components/common/SimpleSelect"
import { DataFormat } from "@/types"
import { outputFormatOptions } from "./constants"

interface CombineOutputCardProps {
  outputName: string
  onOutputNameChange: (name: string) => void
  outputFormat: DataFormat
  onOutputFormatChange: (format: DataFormat) => void
  loading: boolean
  canRun: boolean
  onPreview: () => void
  onCombine: () => void
}

export function CombineOutputCard(props: CombineOutputCardProps) {
  return (
    <SectionCard title="Output Settings" icon={<Database className="h-5 w-5" />} contentClassName="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Output Name">
          <Input
            value={props.outputName}
            onChange={(e) => props.onOutputNameChange(e.target.value)}
            placeholder="combined_dataset"
          />
        </FormField>
        <FormField label="Output Format">
          <SimpleSelect
            value={props.outputFormat}
            onChange={(v) => props.onOutputFormatChange(v as DataFormat)}
            options={outputFormatOptions}
          />
        </FormField>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={props.onPreview} disabled={props.loading || !props.canRun}>
          <Search className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <LoadingButton
          onClick={props.onCombine}
          loading={props.loading}
          loadingText="Combining..."
          disabled={!props.canRun || !props.outputName}
        >
          Combine Datasets
        </LoadingButton>
      </div>
    </SectionCard>
  )
}
