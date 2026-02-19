import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

type AppView = 'workspaceSelector' | 'projectDashboard' | 'pipeline'

interface ExternalChange {
  timestamp: number
  subtitleCount: number
  tracks: Array<{ type: string; segments: number }>
}

interface UIState {
  currentView: AppView
  isLoading: boolean
  loadingMessage: string
  toasts: Toast[]
  settingsOpen: boolean
  timelineOpen: boolean
  timelineZoom: number
  selectedSegmentId: string | null
  externalChange: ExternalChange | null

  setCurrentView: (view: AppView) => void
  setLoading: (loading: boolean, message?: string) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setSettingsOpen: (open: boolean) => void
  setTimelineOpen: (open: boolean) => void
  setTimelineZoom: (zoom: number) => void
  setSelectedSegment: (id: string | null) => void
  setExternalChange: (change: ExternalChange | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      currentView: 'workspaceSelector' as AppView,
      isLoading: false,
      loadingMessage: '',
      toasts: [],
      settingsOpen: false,
      timelineOpen: true,
      timelineZoom: 20,
      selectedSegmentId: null,
      externalChange: null,

      setCurrentView: (view) => {
        set({ currentView: view })
      },
      setLoading: (loading, message = '') => {
        set({ isLoading: loading, loadingMessage: message })
      },

      addToast: (toast) => {
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }]
        }))
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id)
        }))
      },

      setSettingsOpen: (open) => {
        set({ settingsOpen: open })
      },

      setTimelineOpen: (open) => {
        set({ timelineOpen: open })
      },
      setTimelineZoom: (zoom) => {
        set({ timelineZoom: Math.max(5, Math.min(200, zoom)) })
      },
      setSelectedSegment: (id) => {
        set({ selectedSegmentId: id })
      },
      setExternalChange: (change) => {
        set({ externalChange: change })
      }
    }),
    {
      name: 'meu-pipeline-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        timelineOpen: state.timelineOpen,
        timelineZoom: state.timelineZoom
      })
    }
  )
)
