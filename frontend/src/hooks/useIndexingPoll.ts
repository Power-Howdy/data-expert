import * as React from "react"
import { type FeatureKind, useIndexingStore } from "@/stores/useIndexingStore"
import { useDatasetStore } from "@/stores/useStore"

const BUSY_MS = 1000

/** Keeps search-index and browse-copy states current. Every dataset's states load once, and again when the loaded
 * datasets change; after that only datasets with a build in progress are polled, and only for that build. */
export function useIndexingPoll() {
  const progress = useIndexingStore((s) => s.progress)
  const features = useIndexingStore((s) => s.features)
  const loadAll = useIndexingStore((s) => s.loadAll)
  const refresh = useIndexingStore((s) => s.refresh)
  const datasets = useDatasetStore((s) => s.datasets)
  const loaded = datasets.map((d) => `${d.id}@${d.last_modified}`).join("|")

  React.useEffect(() => {
    loadAll()
  }, [loaded, loadAll])

  const building = Object.entries(features)
    .flatMap(([id, f]) => (["search", "browse"] as FeatureKind[]).filter((k) => f[k] === "building").map((k) => `${id}:${k}`))
    .sort()
    .join(",")

  React.useEffect(() => {
    if (!building) return
    const kinds: Record<string, FeatureKind[]> = {}
    for (const entry of building.split(",")) {
      const [id, kind] = entry.split(":")
      ;(kinds[id] ??= []).push(kind as FeatureKind)
    }
    const timer = window.setInterval(() => {
      for (const [id, list] of Object.entries(kinds)) refresh(id, list)
    }, BUSY_MS)
    return () => window.clearInterval(timer)
  }, [building, refresh])

  return { progress, features }
}
