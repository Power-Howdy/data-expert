import { ArrowRight } from "lucide-react"
import { FormField } from "@/components/common/FormField"
import { SimpleSelect, toOptions } from "@/components/common/SimpleSelect"
import { CombineStrategy, JoinConfig, joinTypeOptions } from "./constants"

interface JoinConfigFieldsProps {
  strategy: CombineStrategy
  config: JoinConfig
  onChange: (config: JoinConfig) => void
  commonColumns: string[]
}

export function JoinConfigFields({ strategy, config, onChange, commonColumns }: JoinConfigFieldsProps) {
  const columnOptions = toOptions(commonColumns)
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Left Column">
          <SimpleSelect
            value={config.leftOn}
            onChange={(v) => onChange({ ...config, leftOn: v })}
            options={columnOptions}
            placeholder="Select column"
          />
        </FormField>
        <div className="flex items-center justify-center">
          <ArrowRight className="h-6 w-6 text-muted-foreground" />
        </div>
        <FormField label="Right Column">
          <SimpleSelect
            value={config.rightOn}
            onChange={(v) => onChange({ ...config, rightOn: v })}
            options={columnOptions}
            placeholder="Select column"
          />
        </FormField>
      </div>
      {strategy === "join" && (
        <FormField label="Join Type">
          <SimpleSelect value={config.how} onChange={(v) => onChange({ ...config, how: v })} options={joinTypeOptions} />
        </FormField>
      )}
    </>
  )
}
