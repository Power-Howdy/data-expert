import { cn } from "@/lib/utils"

interface CircularProgressProps {
  /** 0 to 100. */
  value: number
  size?: number
  strokeWidth?: number
  showLabel?: boolean
  title?: string
  className?: string
}

/** A progress ring with the percentage inside. */
export function CircularProgress({ value, size = 32, strokeWidth = 3, showLabel = true, title, className }: CircularProgressProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} title={title}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {showLabel && (
        <span className="absolute font-extrabold tabular-nums" style={{ fontSize: Math.max(8, size * 0.28) }}>
          {percent}%
        </span>
      )}
    </div>
  )
}
