import * as React from "react"
import { cn } from "@/lib/utils"

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; text: string }

function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim()
    const last = blocks[blocks.length - 1]
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    const item = line.match(/^([-*•]|\d+[.)])\s+(.*)$/)
    if (!line) blocks.push({ kind: "paragraph", text: "" })
    else if (heading) blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] })
    else if (item) {
      const ordered = /\d/.test(item[1])
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(item[2])
      else blocks.push({ kind: "list", ordered, items: [item[2]] })
    } else if (last?.kind === "paragraph" && last.text) last.text += ` ${line}`
    else blocks.push({ kind: "paragraph", text: line })
  }
  return blocks.filter((b) => b.kind !== "paragraph" || b.text)
}

function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

const HEADING_CLASS = ["", "text-xl font-black", "text-lg font-black", "text-base font-extrabold", "text-sm font-extrabold"]

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(source), [source])
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      {blocks.map((block, i) => {
        if (block.kind === "heading")
          return <h4 key={i} className={cn("pt-2 text-foreground", HEADING_CLASS[block.level])}>{inline(block.text)}</h4>
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul"
          return (
            <List key={i} className={cn("space-y-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}>
              {block.items.map((item, j) => <li key={j}>{inline(item)}</li>)}
            </List>
          )
        }
        return <p key={i}>{inline(block.text)}</p>
      })}
    </div>
  )
}
