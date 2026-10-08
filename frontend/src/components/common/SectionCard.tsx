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
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("flex items-center gap-2", titleClassName)}>
            {icon}
            {title}
          </CardTitle>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
