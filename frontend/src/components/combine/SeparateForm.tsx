import { Minus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"
import { LoadingButton } from "@/components/common/LoadingButton"
import { SectionCard } from "@/components/common/SectionCard"
import { SimpleSelect, toOptions } from "@/components/common/SimpleSelect"
import { formatNumber } from "@/lib/utils"
import { Dataset, DataFormat } from "@/types"
import { outputFormatOptions } from "./constants"
import { useSeparate } from "./useSeparate"

interface SeparateFormProps {
  datasets: Dataset[]
  state: ReturnType<typeof useSeparate>
}

export function SeparateForm({ datasets, state: s }: SeparateFormProps) {
  const datasetOptions = datasets.map((d) => ({ value: d.id, label: `${d.name} (${formatNumber(d.row_count)} rows)` }))
  const columns = datasets.find((d) => d.id === s.datasetId)?.schema.map((c) => c.name) || []

  return (
    <SectionCard title="Separate Dataset by Column" icon={<Minus className="h-5 w-5" />} contentClassName="space-y-4">
      <FormField label="Dataset">
        <SimpleSelect value={s.datasetId} onChange={s.setDatasetId} options={datasetOptions} placeholder="Select dataset" />
      </FormField>
      <FormField label="Column to Separate By">
        <SimpleSelect
          value={s.column}
          onChange={s.setColumn}
          options={toOptions(columns)}
          placeholder="Select column"
          disabled={!s.datasetId}
        />
      </FormField>
      <FormField label="Output Directory">
        <Input value={s.outputDir} onChange={(e) => s.setOutputDir(e.target.value)} placeholder="./separated_output" />
      </FormField>
      <FormField label="Output Format">
        <SimpleSelect
          value={s.outputFormat}
          onChange={(v) => s.setOutputFormat(v as DataFormat)}
          options={outputFormatOptions}
        />
      </FormField>
      <div className="flex gap-2 pt-4">
        <LoadingButton onClick={s.separate} loading={s.loading} loadingText="Separating..." disabled={!s.canSubmit}>
          Separate Dataset
        </LoadingButton>
      </div>
    </SectionCard>
  )
}
