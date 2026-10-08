import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
}

export function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-2xl font-black text-foreground">{value}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
