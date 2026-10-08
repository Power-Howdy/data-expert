import { Loader2 } from "lucide-react"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingButton } from "@/components/common/LoadingButton"
import { PageHeader } from "@/components/common/PageHeader"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { formatNumber } from "@/lib/utils"
import { useAnalytics } from "./useAnalytics"
import { OverviewStats } from "./OverviewStats"
import { ProfileTabs } from "./ProfileTabs"
import { ColumnDetailPanel } from "./ColumnDetailPanel"

export function AnalyticsTab() {
  const dataset = useSelectedDataset()
  const a = useAnalytics(dataset)

  if (!dataset) return <EmptyState>Select a dataset from the sidebar to view analytics</EmptyState>

  const profileButton = (
    <LoadingButton variant="outline" onClick={a.loadProfile} loading={a.profileLoading} loadingText="Loading...">
      {a.profile ? "Refresh Profile" : "Generate Full Profile"}
    </LoadingButton>
  )

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <PageHeader
        title={`${dataset.name} Analytics`}
        subtitle={`${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns`}
        actions={profileButton}
      />
      {a.loading && a.overview === null ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : a.overview && <OverviewStats overview={a.overview} />}
      {a.profile && (
        <ProfileTabs profile={a.profile} activeColumn={a.activeColumn} onColumnClick={a.selectColumn} />
      )}
      {a.activeColumn && a.columnDist && (
        <ColumnDetailPanel
          column={a.activeColumn}
          distribution={a.columnDist}
          outliers={a.outliers}
          onClose={a.closeColumn}
        />
      )}
    </div>
  )
}
