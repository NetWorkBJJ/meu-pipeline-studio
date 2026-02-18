import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface UIState {
  isLoading: boolean
  loadingMessage: string
  toasts: Toast[]
  settingsOpen: boolean

  setLoading: (loading: boolean, message?: string) => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  setSettingsOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  loadingMessage: '',
  toasts: [],
  settingsOpen: false,

  setLoading: (loading, message = ''): void =>
    set({ isLoading: loading, loadingMessage: message }),

  addToast: (toast): void =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }]
    })),

  removeToast: (id): void =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    })),

  setSettingsOpen: (open): void => set({ settingsOpen: open })
}))
