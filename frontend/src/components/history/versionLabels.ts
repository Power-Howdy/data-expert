import type { CommitKind, VersionStats } from "@/types/version"

export const KIND_LABELS: Record<CommitKind, string> = {
  baseline: "First version",
  edit: "Edit",
  restore: "Restore",
  external: "Changed outside",
}

const STAT_LABELS: Array<[keyof VersionStats, string]> = [
  ["added", "added"], ["updated", "edited"], ["deleted", "deleted"], ["replaced", "replaced"], ["transformed", "transforms"],
]

export function shortId(id: string) {
  return id.slice(0, 7)
}

export function statsText(stats: VersionStats) {
  return STAT_LABELS.filter(([key]) => stats[key] > 0).map(([key, label]) => `${stats[key]} ${label}`).join(" · ")
}

export function timeAgo(iso: string) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const steps: Array<[number, string]> = [[60, "minute"], [3600, "hour"], [86400, "day"], [2592000, "month"], [31536000, "year"]]
  const [size, unit] = [...steps].reverse().find(([s]) => seconds >= s) ?? steps[0]
  const count = Math.floor(seconds / size)
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`
}

export const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/
