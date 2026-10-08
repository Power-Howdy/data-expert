import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingButton } from "@/components/common/LoadingButton"
import { SidePanel } from "@/components/common/SidePanel"
import { useSettingsDraft } from "./useSettingsDraft"
import { ProviderSettings } from "./ProviderSettings"
import { ModelSettings } from "./ModelSettings"
import { PromptSettings } from "./PromptSettings"
import { FunctionLibrary } from "./FunctionLibrary"

export function AISettingsPanel() {
  const s = useSettingsDraft()

  const footer = (
    <>
      <Button variant="ghost" onClick={s.close}>Cancel</Button>
      <LoadingButton onClick={s.save} loading={s.saving} loadingText="Saving..." disabled={!s.draft}>
        Save settings
      </LoadingButton>
    </>
  )

  return (
    <SidePanel
      title="AI settings"
      subtitle="Provider, model and prompts used by AI transforms and insights"
      onClose={s.close}
      footer={footer}
    >
      {!s.draft ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="provider">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="provider">Provider</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="functions">Functions</TabsTrigger>
          </TabsList>
          <TabsContent value="provider" className="pt-4">
            <ProviderSettings draft={s} />
          </TabsContent>
          <TabsContent value="model" className="pt-4">
            <ModelSettings draft={s} />
          </TabsContent>
          <TabsContent value="prompts" className="pt-4">
            <PromptSettings draft={s} />
          </TabsContent>
          <TabsContent value="functions" className="pt-4">
            <FunctionLibrary />
          </TabsContent>
        </Tabs>
      )}
    </SidePanel>
  )
}
