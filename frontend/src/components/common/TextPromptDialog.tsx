import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "./FormField"
import { LoadingButton } from "./LoadingButton"
import { Modal } from "./Modal"

interface TextPromptDialogProps {
  title: string
  label: string
  description?: React.ReactNode
  initialValue?: string
  placeholder?: string
  submitLabel?: string
  /** Allow submitting an empty value. */
  optional?: boolean
  /** Return an error message to show, or nothing when valid. */
  validate?: (value: string) => string | undefined
  onSubmit: (value: string) => Promise<unknown> | void
  onClose: () => void
}

/** A small dialog asking for one line of text. */
export function TextPromptDialog({
  title, label, description, initialValue = "", placeholder, submitLabel = "Save", optional, validate, onSubmit, onClose,
}: TextPromptDialogProps) {
  const [value, setValue] = React.useState(initialValue)
  const [busy, setBusy] = React.useState(false)
  const error = value ? validate?.(value) : undefined
  const disabled = busy || !!error || (!optional && !value.trim())

  const submit = async () => {
    if (disabled) return
    setBusy(true)
    try {
      await onSubmit(value.trim())
      onClose()
    } catch {
      // the caller reports the error
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <LoadingButton onClick={submit} loading={busy} loadingText="Saving..." disabled={disabled}>
        {submitLabel}
      </LoadingButton>
    </>
  )

  return (
    <Modal title={title} onClose={onClose} footer={footer}>
      {description && <p className="text-sm font-semibold text-muted-foreground">{description}</p>}
      <FormField label={label}>
        <Input
          value={value} placeholder={placeholder} autoFocus
          onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </FormField>
      {error && <p className="text-xs font-bold text-destructive">{error}</p>}
    </Modal>
  )
}
