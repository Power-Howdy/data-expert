import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  titleClassName?: string
  contentClassName?: string
  children: React.ReactNode
}

export function SectionCard({
  title,
  icon,
  actions,
  className,
  titleClassName,
  contentClassName,
  children,
}: SectionCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b-2 border-border bg-muted/40">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className={cn("flex items-center gap-2 text-base", titleClassName)}>
            {icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                {icon}
              </span>
            )}
            {title}
          </CardTitle>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-5", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
