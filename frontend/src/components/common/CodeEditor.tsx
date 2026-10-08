import * as React from "react"
import CodeMirror from "@uiw/react-codemirror"
import { json } from "@codemirror/lang-json"
import { EditorView } from "@codemirror/view"
import { useUIStore } from "@/stores/useStore"
import { cn } from "@/lib/utils"

export type CodeLanguage = "json" | "text"

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: CodeLanguage
  readOnly?: boolean
  placeholder?: string
  minHeight?: string
  maxHeight?: string
  autoFocus?: boolean
  invalid?: boolean
  className?: string
}

export function CodeEditor({
  value, onChange, language = "text", readOnly, placeholder, minHeight = "2.5rem", maxHeight = "24rem",
  autoFocus, invalid, className,
}: CodeEditorProps) {
  const theme = useUIStore((s) => s.theme)
  const extensions = React.useMemo(
    () => (language === "json" ? [json(), EditorView.lineWrapping] : [EditorView.lineWrapping]),
    [language]
  )

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-2 text-sm focus-within:border-primary",
        invalid ? "border-destructive" : "border-input",
        className
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={theme}
        readOnly={readOnly}
        editable={!readOnly}
        placeholder={placeholder}
        minHeight={minHeight}
        maxHeight={maxHeight}
        autoFocus={autoFocus}
        basicSetup={{ lineNumbers: language === "json", foldGutter: language === "json", highlightActiveLine: !readOnly }}
      />
    </div>
  )
}
