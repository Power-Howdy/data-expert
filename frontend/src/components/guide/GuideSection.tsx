import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GuideTopic } from "./guideContent"

interface GuideSectionProps {
  topic: GuideTopic
  onOpen?: (tab: string) => void
}

/** One topic of the user guide. */
export function GuideSection({ topic, onOpen }: GuideSectionProps) {
  const Icon = topic.icon
  return (
    <section id={`guide-${topic.id}`} className="scroll-mt-4 space-y-3 rounded-3xl border-2 border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="flex-1 text-xl font-black">{topic.title}</h2>
        {topic.tab && onOpen && (
          <Button variant="ghost" size="sm" onClick={() => onOpen(topic.tab!)}>
            Open <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{topic.intro}</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm font-semibold">
        {topic.points.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
    </section>
  )
}
