import * as React from "react"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { AnalyticsOverview, Dataset, DatasetProfile } from "@/types"

export function useAnalytics(dataset: Dataset | undefined) {
  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(null)
  const [profile, setProfile] = React.useState<DatasetProfile | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [profileLoading, setProfileLoading] = React.useState(false)
  const [activeColumn, setActiveColumn] = React.useState<string | null>(null)
  const [columnDist, setColumnDist] = React.useState<any>(null)
  const [outliers, setOutliers] = React.useState<any>(null)

  const datasetId = dataset?.id

  React.useEffect(() => {
    setOverview(null)
    setProfile(null)
    setActiveColumn(null)
    if (!datasetId) return
    let cancelled = false
    setLoading(true)
    api.getStats(datasetId)
      .then((data) => !cancelled && setOverview(data))
      .catch(() => !cancelled && toast.error("Failed to load overview"))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [datasetId])

  const loadProfile = async () => {
    if (!dataset) return
    setProfileLoading(true)
    try {
      setProfile(await api.getProfile(dataset.id))
    } catch (error) {
      toast.error("Failed to load profile")
    } finally {
      setProfileLoading(false)
    }
  }

  const selectColumn = (column: string) => {
    if (!dataset) return
    setActiveColumn(column)
    api.getDistribution(dataset.id, column)
      .then(setColumnDist)
      .catch(() => toast.error("Failed to load distribution"))
    api.getOutliers(dataset.id, column)
      .then(setOutliers)
      .catch(() => toast.error("Failed to load outliers"))
  }

  return {
    overview, loading,
    profile, profileLoading, loadProfile,
    activeColumn, columnDist, outliers, selectColumn,
    closeColumn: () => setActiveColumn(null),
  }
}
