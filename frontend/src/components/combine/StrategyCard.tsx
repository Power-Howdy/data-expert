import { Settings } from "lucide-react"
import { FormField } from "@/components/common/FormField"
import { SectionCard } from "@/components/common/SectionCard"
import { SimpleSelect } from "@/components/common/SimpleSelect"
import { CombineStrategy, JoinConfig, strategyOptions } from "./constants"
import { JoinConfigFields } from "./JoinConfigFields"

interface StrategyCardProps {
  strategy: CombineStrategy
  onStrategyChange: (strategy: CombineStrategy) => void
  joinConfig: JoinConfig
  onJoinConfigChange: (config: JoinConfig) => void
  commonColumns: string[]
}

export function StrategyCard(props: StrategyCardProps) {
  return (
    <SectionCard title="Combine Strategy" icon={<Settings className="h-5 w-5" />} contentClassName="space-y-4">
      <FormField label="Strategy">
        <SimpleSelect
          value={props.strategy}
          onChange={(v) => props.onStrategyChange(v as CombineStrategy)}
          options={strategyOptions}
        />
      </FormField>
      {props.strategy !== "concat" && (
        <JoinConfigFields
          strategy={props.strategy}
          config={props.joinConfig}
          onChange={props.onJoinConfigChange}
          commonColumns={props.commonColumns}
        />
      )}
    </SectionCard>
  )
}
