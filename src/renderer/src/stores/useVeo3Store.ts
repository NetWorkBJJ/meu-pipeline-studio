import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Veo3DownloadItem,
  Veo3Account,
  Veo3Tab
} from '@/types/veo3'

const MAX_ACCOUNTS = 5

const ACCOUNT_COLORS = [
  '#4285F4', // Google Blue
  '#EA4335', // Google Red
  '#34A853', // Google Green
  '#FBBC04', // Google Yellow
  '#8B5CF6' // Purple
]

// ─── Account Store (persisted) ───────────────────────────────────────

interface Veo3AccountState {
  accounts: Veo3Account[]
  defaultAccountId: string | null

  addAccount: (name: string, description?: string, color?: string) => Veo3Account | null
  updateAccount: (id: string, updates: Partial<Pick<Veo3Account, 'name' | 'description' | 'color'>>) => void
  removeAccount: (id: string) => void
  setDefaultAccount: (id: string) => void
  touchAccount: (id: string) => void
  getNextPartition: () => string | null
}

export const useVeo3AccountStore = create<Veo3AccountState>()(
  persist(
    (set, get) => ({
      accounts: [],
      defaultAccountId: null,

      addAccount: (name, description = '', color) => {
        const state = get()
        if (state.accounts.length >= MAX_ACCOUNTS) return null

        const partition = get().getNextPartition()
        if (!partition) return null

        const usedColors = state.accounts.map((a) => a.color)
        const autoColor = color || ACCOUNT_COLORS.find((c) => !usedColors.includes(c)) || ACCOUNT_COLORS[0]

        const account: Veo3Account = {
          id: `veo3_acc_${Date.now()}`,
          name,
          description,
          partition,
          color: autoColor,
          createdAt: Date.now(),
          lastUsed: null
        }

        set((s) => {
          const updated = [...s.accounts, account]
          return {
            accounts: updated,
            defaultAccountId: s.defaultAccountId ?? account.id
          }
        })

        return account
      },

      updateAccount: (id, updates) => {
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a))
        }))
      },

      removeAccount: (id) => {
        set((s) => {
          const filtered = s.accounts.filter((a) => a.id !== id)
          const newDefault =
            s.defaultAccountId === id ? (filtered[0]?.id ?? null) : s.defaultAccountId
          return { accounts: filtered, defaultAccountId: newDefault }
        })
      },

      setDefaultAccount: (id) => {
        set({ defaultAccountId: id })
      },

      touchAccount: (id) => {
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, lastUsed: Date.now() } : a
          )
        }))
      },

      getNextPartition: () => {
        const used = get().accounts.map((a) => a.partition)
        for (let i = 1; i <= MAX_ACCOUNTS; i++) {
          const name = `persist:veo3-account-${i}`
          if (!used.includes(name)) return name
        }
        return null
      }
    }),
    {
      name: 'veo3-accounts',
      partialize: (state) => ({
        accounts: state.accounts,
        defaultAccountId: state.defaultAccountId
      })
    }
  )
)

// ─── Tab Store (persisted) ───────────────────────────────────────────

interface Veo3TabState {
  tabs: Veo3Tab[]
  activeTabId: string | null

  openTab: (accountId: string) => Veo3Tab
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  reorderTabs: (reordered: Veo3Tab[]) => void
  isAccountOpen: (accountId: string) => boolean
  getActiveTab: () => Veo3Tab | null
  resetTabs: () => void
}

export const useVeo3TabStore = create<Veo3TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (accountId) => {
        const tab: Veo3Tab = {
          id: `veo3_tab_${Date.now()}`,
          accountId
        }

        set((s) => ({
          tabs: [...s.tabs, tab],
          activeTabId: tab.id
        }))

        return tab
      },

      closeTab: (tabId) => {
        set((s) => {
          const filtered = s.tabs.filter((t) => t.id !== tabId)
          let newActive = s.activeTabId
          if (s.activeTabId === tabId) {
            newActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null
          }
          return { tabs: filtered, activeTabId: newActive }
        })
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
      },

      reorderTabs: (reordered) => {
        set({ tabs: reordered })
      },

      isAccountOpen: (accountId) => {
        return get().tabs.some((t) => t.accountId === accountId)
      },

      getActiveTab: () => {
        const { tabs, activeTabId } = get()
        return tabs.find((t) => t.id === activeTabId) ?? null
      },

      resetTabs: () => {
        set({ tabs: [], activeTabId: null })
      }
    }),
    {
      name: 'veo3-tabs',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId
      })
    }
  )
)

// ─── UI Store (not persisted - global settings) ─────────────────────

interface Veo3UIState {
  zoomFactor: number

  // Downloads (global, shared across all tabs)
  downloadPath: string
  autoDownload: boolean
  downloads: Veo3DownloadItem[]

  // Actions
  setZoomFactor: (factor: number) => void
  addDownload: (item: Veo3DownloadItem) => void
  setDownloadPath: (path: string) => void
  setAutoDownload: (auto: boolean) => void
  reset: () => void
}

const uiInitialState = {
  zoomFactor: 0.8,
  downloadPath: '',
  autoDownload: true,
  downloads: [] as Veo3DownloadItem[]
}

export const useVeo3Store = create<Veo3UIState>((set) => ({
  ...uiInitialState,

  setZoomFactor: (factor) => set({ zoomFactor: factor }),
  addDownload: (item) => set((s) => ({ downloads: [item, ...s.downloads] })),
  setDownloadPath: (path) => set({ downloadPath: path }),
  setAutoDownload: (auto) => set({ autoDownload: auto }),

  reset: () => set(uiInitialState)
}))
