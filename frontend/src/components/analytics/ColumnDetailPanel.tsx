import { SidePanel } from "@/components/common/SidePanel"
import type { ColumnProfile } from "@/types"
import { DistributionChart } from "./DistributionChart"
import { OutliersList } from "./OutliersList"
import { OutliersChart } from "./OutliersChart"

interface ColumnDetailPanelProps {
  column: string
  /** The column's entry in the dataset profile, when there is one (adds exact quartiles). */
  profile?: ColumnProfile
  distribution: any
  outliers: any
  onClose: () => void
}

export function ColumnDetailPanel({ column, profile, distribution, outliers, onClose }: ColumnDetailPanelProps) {
  return (
    <SidePanel title={`Column Details: ${column}`} onClose={onClose}>
      <DistributionChart distribution={distribution} profile={profile} outliers={outliers} />
      {outliers && outliers.count > 0 && (
        <>
          <OutliersChart outliers={outliers} />
          <OutliersList outliers={outliers} />
        </>
      )}
    </SidePanel>
  )
}
