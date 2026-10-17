import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "sky"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button"
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-extrabold uppercase tracking-wide",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground duo-press shadow-duo-primary": variant === "default",
            "bg-secondary text-secondary-foreground shadow-duo-secondary hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--secondary-shadow))] transition-[transform,box-shadow] duration-75":
              variant === "sky" || variant === "secondary",
            "bg-destructive text-destructive-foreground shadow-[0_4px_0_0_hsl(var(--destructive-shadow))] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--destructive-shadow))] transition-[transform,box-shadow] duration-75":
              variant === "destructive",
            "border-2 border-border bg-card text-foreground shadow-duo hover:bg-muted active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--border))] transition-[transform,box-shadow] duration-75":
              variant === "outline",
            "hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl": variant === "ghost",
            "text-primary underline-offset-4 hover:underline font-bold normal-case tracking-normal": variant === "link",
            "h-11 px-5": size === "default",
            "h-9 rounded-xl px-3 text-xs": size === "sm",
            "h-12 rounded-2xl px-8 text-base": size === "lg",
            "h-11 w-11 p-0": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
