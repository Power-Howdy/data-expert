import * as React from "react"

/** Independent on/off switches by name, e.g. which panels of a page are open. */
export function useToggles<K extends string>() {
  const [open, setOpen] = React.useState<Partial<Record<K, boolean>>>({})
  const isOpen = (key: K) => Boolean(open[key])
  const toggle = (key: K) => setOpen((o) => ({ ...o, [key]: !o[key] }))
  const close = (key: K) => setOpen((o) => ({ ...o, [key]: false }))
  return { isOpen, toggle, close }
}
