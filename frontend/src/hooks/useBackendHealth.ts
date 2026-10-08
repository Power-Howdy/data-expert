import * as React from "react"
import { api } from "@/lib/api"

const POLL_MS = 15000

/** Whether the backend answers, re-checked periodically and when the window regains focus. */
export function useBackendHealth() {
  const [online, setOnline] = React.useState<boolean | null>(null)
  const [version, setVersion] = React.useState<string | null>(null)

  React.useEffect(() => {
    const check = async () => {
      try {
        const health = await api.health()
        setOnline(health.status === "healthy")
        setVersion(health.version)
      } catch {
        setOnline(false)
      }
    }
    check()
    const timer = window.setInterval(check, POLL_MS)
    window.addEventListener("focus", check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", check)
    }
  }, [])

  return { online, version }
}
