import * as React from "react"
import { Button, type ButtonProps } from "@/components/ui/button"

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  onConfirm: () => void
  confirmLabel?: React.ReactNode
}

/** Asks for a second click before running a destructive action. */
export function ConfirmButton({ onConfirm, confirmLabel = "Click again to confirm", children, variant, ...props }: ConfirmButtonProps) {
  const [armed, setArmed] = React.useState(false)

  React.useEffect(() => {
    if (!armed) return
    const timer = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(timer)
  }, [armed])

  const click = () => {
    if (!armed) return setArmed(true)
    setArmed(false)
    onConfirm()
  }

  return (
    <Button {...props} variant={armed ? "destructive" : variant} onClick={click}>
      {armed ? confirmLabel : children}
    </Button>
  )
}
