"use client"
import * as React from "react"
import * as SlotPrimitive from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

const Slot = React.forwardRef<
  React.ElementRef<typeof SlotPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SlotPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SlotPrimitive.Root
    ref={ref}
    className={cn(className)}
    {...props}
  />
))
Slot.displayName = SlotPrimitive.Root.displayName

export { Slot }