import type { GuideTopic } from "./guideContent"

interface GuideTocProps {
  topics: GuideTopic[]
}

/** Table of contents linking to the guide's sections. */
export function GuideToc({ topics }: GuideTocProps) {
  const jump = (id: string) =>
    document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <nav className="space-y-1 rounded-3xl border-2 border-border bg-card p-3" aria-label="Guide contents">
      <p className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Contents</p>
      {topics.map(({ id, title, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => jump(id)}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon className="h-4 w-4 shrink-0" /> {title}
        </button>
      ))}
    </nav>
  )
}
