import { BarChart3, Loader2 } from "lucide-react"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingButton } from "@/components/common/LoadingButton"
import { PageHeader } from "@/components/common/PageHeader"
import { useSelectedDataset } from "@/hooks/useSelectedDataset"
import { formatNumber } from "@/lib/utils"
import { DatasetProfile } from "@/types"
import { useAnalytics } from "./useAnalytics"
import { OverviewStats } from "./OverviewStats"
import { ProfileTabs } from "./ProfileTabs"
import { ColumnDetailPanel } from "./ColumnDetailPanel"

function profileInfo(profile: DatasetProfile | null) {
  if (!profile?.generated_at) return ""
  const when = new Date(profile.generated_at).toLocaleString()
  return `Profiled ${when}${profile.sampled ? ` (sample of ${formatNumber(profile.row_count)})` : ""}`
}

export function AnalyticsTab() {
  const dataset = useSelectedDataset()
  const a = useAnalytics(dataset)

  if (!dataset) {
    return (
      <EmptyState icon={<BarChart3 className="h-9 w-9" />} title="Ready for stats">
        Load a dataset to unlock overview metrics, profiles, and charts
      </EmptyState>
    )
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        title={`${dataset.name} Analytics`}
        subtitle={[
          `${formatNumber(dataset.row_count)} rows · ${dataset.schema.length} columns`,
          profileInfo(a.profile),
        ].filter(Boolean).join(" · ")}
        actions={
          <LoadingButton onClick={a.loadProfile} loading={a.profileLoading} loadingText="Profiling...">
            {a.profile ? "Regenerate Profile" : "Generate Profile"}
          </LoadingButton>
        }
      />
      {a.loading && a.overview === null ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        a.overview && <OverviewStats overview={a.overview} />
      )}
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
