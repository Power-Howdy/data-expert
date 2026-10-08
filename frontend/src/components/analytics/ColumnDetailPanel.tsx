import { SidePanel } from "@/components/common/SidePanel"
import { DistributionChart } from "./DistributionChart"
import { OutliersList } from "./OutliersList"

interface ColumnDetailPanelProps {
  column: string
  distribution: any
  outliers: any
  onClose: () => void
}

export function ColumnDetailPanel({ column, distribution, outliers, onClose }: ColumnDetailPanelProps) {
  return (
    <SidePanel title={`Column Details: ${column}`} onClose={onClose}>
      <div>
        <h4 className="font-medium mb-2">Distribution</h4>
        <DistributionChart distribution={distribution} />
      </div>
      {outliers && outliers.count > 0 && <OutliersList outliers={outliers} />}
    </SidePanel>
  )
}
