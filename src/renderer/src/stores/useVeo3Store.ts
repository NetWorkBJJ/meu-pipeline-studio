import { create } from 'zustand'
import type { Veo3AutomationStatus, Veo3DownloadItem, GoogleAccount, Veo3ContentMessage } from '@/types/veo3'

interface Veo3State {
  // Webview
  isLoading: boolean
  currentUrl: string
  canGoBack: boolean
  canGoForward: boolean
  zoomFactor: number
  isLoggedIn: boolean

  // Sidepanel
  sidepanelVisible: boolean

  // Automation
  automationStatus: Veo3AutomationStatus
  currentPromptIndex: number
  totalPrompts: number
  promptsProcessed: number
  elapsedMs: number

  // Downloads
  downloadPath: string
  autoDownload: boolean
  downloads: Veo3DownloadItem[]

  // Accounts
  accounts: GoogleAccount[]
  activeAccountIndex: number

  // Actions
  setWebviewState: (state: Partial<Pick<Veo3State, 'isLoading' | 'currentUrl' | 'canGoBack' | 'canGoForward' | 'zoomFactor' | 'isLoggedIn'>>) => void
  setSidepanelVisible: (visible: boolean) => void
  toggleSidepanel: () => void
  setAutomationStatus: (status: Veo3AutomationStatus) => void
  handleContentMessage: (msg: Veo3ContentMessage) => void
  addDownload: (item: Veo3DownloadItem) => void
  setDownloadPath: (path: string) => void
  setAutoDownload: (auto: boolean) => void
  addAccount: (account: GoogleAccount) => void
  setActiveAccount: (index: number) => void
  reset: () => void
}

const initialState = {
  isLoading: false,
  currentUrl: '',
  canGoBack: false,
  canGoForward: false,
  zoomFactor: 0.8,
  isLoggedIn: false,
  sidepanelVisible: true,
  automationStatus: 'idle' as Veo3AutomationStatus,
  currentPromptIndex: 0,
  totalPrompts: 0,
  promptsProcessed: 0,
  elapsedMs: 0,
  downloadPath: '',
  autoDownload: true,
  downloads: [] as Veo3DownloadItem[],
  accounts: [] as GoogleAccount[],
  activeAccountIndex: 0
}

export const useVeo3Store = create<Veo3State>((set) => ({
  ...initialState,

  setWebviewState: (partial) => set(partial),

  setSidepanelVisible: (visible) => set({ sidepanelVisible: visible }),

  toggleSidepanel: () => set((state) => ({ sidepanelVisible: !state.sidepanelVisible })),

  setAutomationStatus: (status) => set({ automationStatus: status }),

  handleContentMessage: (msg) => {
    const { action, data } = msg
    if (!action) return

    switch (action) {
      case 'AUTOMATION_STARTED':
        set({ automationStatus: 'running' })
        break
      case 'AUTOMATION_STOPPED':
        set({ automationStatus: 'stopped' })
        break
      case 'AUTOMATION_PAUSED':
        set({ automationStatus: 'paused' })
        break
      case 'AUTOMATION_RESUMED':
        set({ automationStatus: 'running' })
        break
      case 'AUTOMATION_COMPLETE':
        set({ automationStatus: 'completed' })
        break
      case 'AUTOMATION_PROGRESS': {
        const progress = data as { current?: number; total?: number; elapsed?: number } | undefined
        if (progress) {
          set({
            currentPromptIndex: progress.current ?? 0,
            totalPrompts: progress.total ?? 0,
            elapsedMs: progress.elapsed ?? 0,
            promptsProcessed: progress.current ?? 0
          })
        }
        break
      }
      case 'LOGIN_DETECTED':
        set({ isLoggedIn: true })
        break
    }
  },

  addDownload: (item) =>
    set((state) => ({ downloads: [item, ...state.downloads] })),

  setDownloadPath: (path) => set({ downloadPath: path }),

  setAutoDownload: (auto) => set({ autoDownload: auto }),

  addAccount: (account) =>
    set((state) => ({ accounts: [...state.accounts, account] })),

  setActiveAccount: (index) => set({ activeAccountIndex: index }),

  reset: () => set(initialState)
}))
