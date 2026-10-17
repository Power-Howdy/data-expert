import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"

interface LoadingButtonProps extends ButtonProps {
  loading: boolean
  loadingText?: React.ReactNode
}

export function LoadingButton({ loading, loadingText, children, disabled, ...props }: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </Button>
  )
}
