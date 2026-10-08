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
  const latestId = React.useRef(datasetId)
  latestId.current = datasetId

  React.useEffect(() => {
    setOverview(null)
    setProfile(null)
    setProfileLoading(false)
    setActiveColumn(null)
    if (!datasetId) return
    let cancelled = false
    setLoading(true)
    api.getStats(datasetId)
      .then((data) => !cancelled && setOverview(data))
      .catch(() => !cancelled && toast.error("Failed to load overview"))
      .finally(() => !cancelled && setLoading(false))
    api.getSavedProfile(datasetId)
      .then((data) => !cancelled && data && setProfile(data))
      .catch(() => {})
    return () => { cancelled = true }
  }, [datasetId])

  const loadProfile = async () => {
    if (!datasetId) return
    const id = datasetId
    setProfileLoading(true)
    try {
      const data = await api.getProfile(id, { refresh: profile !== null })
      if (id === latestId.current) setProfile(data)
    } catch (error) {
      toast.error("Failed to generate profile")
    } finally {
      setProfileLoading(false)
    }
  }

  const selectColumn = (column: string) => {
    if (!dataset) return
    setActiveColumn(column)
    setColumnDist(null)
    setOutliers(null)
    api.getDistribution(dataset.id, column)
      .then(setColumnDist)
      .catch((e) => setColumnDist({
        type: "bar", values: [], note: `Could not load distribution: ${e?.response?.data?.detail ?? e.message}`,
      }))
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
