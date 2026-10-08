import { create } from "zustand"
import { aiApi } from "@/lib/aiApi"
import type { AISettings } from "@/types/ai"

interface AIState {
  settings: AISettings | null
  settingsOpen: boolean
  load: () => Promise<void>
  setSettings: (settings: AISettings) => void
  openSettings: () => void
  closeSettings: () => void
}

export const useAIStore = create<AIState>()((set) => ({
  settings: null,
  settingsOpen: false,
  load: async () => {
    try {
      set({ settings: await aiApi.getSettings() })
    } catch {
      set({ settings: null })
    }
  },
  setSettings: (settings) => set({ settings }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}))

export function useAIConfigured(): boolean {
  return useAIStore((s) => Boolean(s.settings?.configured))
}
