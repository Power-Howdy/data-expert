import * as React from "react"
import { useIndexingStore } from "@/stores/useIndexingStore"

const BUSY_MS = 1000
const IDLE_MS = 5000

/** Keeps search-index progress and dataset feature states current: every second while something builds, every
 * few seconds otherwise. */
export function useIndexingPoll() {
  const progress = useIndexingStore((s) => s.progress)
  const features = useIndexingStore((s) => s.features)
  const refresh = useIndexingStore((s) => s.refresh)
  const busy =
    Object.values(progress).some((p) => p.state === "building") ||
    Object.values(features).some((f) => f.browse === "building" || f.search === "building")

  React.useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, busy ? BUSY_MS : IDLE_MS)
    return () => window.clearInterval(timer)
  }, [busy, refresh])

  return { progress, features }
}
