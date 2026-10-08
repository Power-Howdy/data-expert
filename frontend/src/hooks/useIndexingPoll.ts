import * as React from "react"
import { useIndexingStore } from "@/stores/useIndexingStore"

const BUSY_MS = 1000
const IDLE_MS = 5000

/** Keeps search-index progress current: every second while an index builds, every few seconds otherwise. */
export function useIndexingPoll() {
  const progress = useIndexingStore((s) => s.progress)
  const refresh = useIndexingStore((s) => s.refresh)
  const busy = Object.values(progress).some((p) => p.state === "building")

  React.useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, busy ? BUSY_MS : IDLE_MS)
    return () => window.clearInterval(timer)
  }, [busy, refresh])

  return progress
}
