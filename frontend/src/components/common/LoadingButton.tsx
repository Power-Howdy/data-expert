import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LoadingButtonProps extends ButtonProps {
  loading: boolean
  loadingText?: React.ReactNode
}

export function LoadingButton({ loading, loadingText, children, disabled, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      <Loader2 className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
      {loading && loadingText ? loadingText : children}
    </Button>
  )
}
