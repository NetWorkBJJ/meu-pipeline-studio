import { create } from 'zustand'

type LogType = 'info' | 'success' | 'error' | 'warning'

interface LogEntry {
  id: string
  type: LogType
  message: string
  timestamp: number
}

interface LogState {
  logs: LogEntry[]
  addLog: (type: LogType, message: string) => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],

  addLog: (type, message): void => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now()
    }

    set((state) => ({
      logs: [...state.logs.slice(-199), entry]
    }))

    const method = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log'
    console[method](`[${type.toUpperCase()}]`, message)
  },

  clearLogs: (): void => set({ logs: [] })
}))

export function selectLogsByType(logs: LogEntry[], type: LogType): LogEntry[] {
  return logs.filter((l) => l.type === type)
}

export function selectRecentLogs(logs: LogEntry[], count: number): LogEntry[] {
  return logs.slice(-count)
}

export function selectLastLog(logs: LogEntry[]): LogEntry | null {
  return logs.length > 0 ? logs[logs.length - 1] : null
}

export function selectErrorCount(logs: LogEntry[]): number {
  return logs.filter((l) => l.type === 'error').length
}
