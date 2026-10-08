import { PageHeader } from "@/components/common/PageHeader"
import { useUIStore } from "@/stores/useStore"
import { GUIDE_TOPICS } from "./guideContent"
import { GuideSection } from "./GuideSection"
import { GuideToc } from "./GuideToc"

/** The user guide: what each part of the app does and how to use it. */
export function GuidePage() {
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="User guide" subtitle="How to explore, edit and version your data" />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <GuideToc topics={GUIDE_TOPICS} />
        </aside>
        <div className="space-y-4">
          {GUIDE_TOPICS.map((topic) => (
            <GuideSection key={topic.id} topic={topic} onOpen={setActiveTab} />
          ))}
        </div>
      </div>
    </div>
  )
}
