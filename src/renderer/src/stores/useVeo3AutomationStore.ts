import { create } from 'zustand'
import type { FlowCommand, FlowCommandStatus, FlowCharacterImageRef } from '@/types/veo3'
import { buildFlowCommands } from '@/lib/flowCommandBuilder'
import { useProjectStore } from './useProjectStore'

export interface TabAutomationState {
  isRunning: boolean
  isPaused: boolean
  currentCommandIndex: number
  startedAt: number | null
  error: string | null
  chapterFilter: number[] | null
}

export const DEFAULT_TAB_AUTOMATION: TabAutomationState = {
  isRunning: false,
  isPaused: false,
  currentCommandIndex: 0,
  startedAt: null,
  error: null,
  chapterFilter: null
}

interface Veo3AutomationState {
  commands: FlowCommand[]
  tabStates: Record<string, TabAutomationState>

  // Global
  loadFromProject: () => void
  updateCommandStatus: (commandId: string, status: FlowCommandStatus, error?: string) => void
  updateCharacterGalleryName: (characterId: string, galleryItemName: string) => void
  reset: () => void

  // Per-tab
  getTabState: (tabId: string) => TabAutomationState
  startTab: (tabId: string) => void
  pauseTab: (tabId: string) => void
  resumeTab: (tabId: string) => void
  stopTab: (tabId: string, error?: string) => void
  advanceToNext: (tabId: string) => void
  setChapterFilter: (tabId: string, chapters: number[] | null) => void
  assignCommandsToTab: (tabId: string) => void
  getFilteredCommands: (tabId?: string | null) => FlowCommand[]
  getProgress: (tabId?: string | null) => { completed: number; failed: number; total: number; percentage: number }
}

const initialState = {
  commands: [] as FlowCommand[],
  tabStates: {} as Record<string, TabAutomationState>
}

export const useVeo3AutomationStore = create<Veo3AutomationState>((set, get) => ({
  ...initialState,

  loadFromProject: () => {
    const { scenes, characterRefs } = useProjectStore.getState()
    const commands = buildFlowCommands(scenes, characterRefs)
    set({ ...initialState, commands })
  },

  updateCommandStatus: (commandId, status, error) => {
    set((s) => ({
      commands: s.commands.map((cmd) => {
        if (cmd.id !== commandId) return cmd
        return {
          ...cmd,
          status,
          error: error ?? cmd.error,
          submittedAt: status === 'submitted' ? Date.now() : cmd.submittedAt,
          completedAt: status === 'done' || status === 'failed' ? Date.now() : cmd.completedAt
        }
      })
    }))
  },

  updateCharacterGalleryName: (characterId, galleryItemName) => {
    set((s) => ({
      commands: s.commands.map((cmd) => ({
        ...cmd,
        characterImages: cmd.characterImages.map((ci: FlowCharacterImageRef) =>
          ci.characterId === characterId ? { ...ci, galleryItemName } : ci
        )
      }))
    }))
  },

  reset: () => {
    set(initialState)
  },

  getTabState: (tabId) => {
    return get().tabStates[tabId] || DEFAULT_TAB_AUTOMATION
  },

  startTab: (tabId) => {
    set((s) => ({
      tabStates: {
        ...s.tabStates,
        [tabId]: {
          ...(s.tabStates[tabId] || DEFAULT_TAB_AUTOMATION),
          isRunning: true,
          isPaused: false,
          currentCommandIndex: 0,
          startedAt: Date.now(),
          error: null
        }
      }
    }))
  },

  pauseTab: (tabId) => {
    set((s) => ({
      tabStates: {
        ...s.tabStates,
        [tabId]: {
          ...(s.tabStates[tabId] || DEFAULT_TAB_AUTOMATION),
          isPaused: true
        }
      }
    }))
  },

  resumeTab: (tabId) => {
    set((s) => ({
      tabStates: {
        ...s.tabStates,
        [tabId]: {
          ...(s.tabStates[tabId] || DEFAULT_TAB_AUTOMATION),
          isPaused: false
        }
      }
    }))
  },

  stopTab: (tabId, error) => {
    set((s) => {
      const current = s.tabStates[tabId] || DEFAULT_TAB_AUTOMATION
      return {
        tabStates: {
          ...s.tabStates,
          [tabId]: {
            ...current,
            isRunning: false,
            isPaused: false,
            error: error !== undefined ? error : current.error
          }
        }
      }
    })
  },

  advanceToNext: (tabId) => {
    set((s) => {
      const ts = s.tabStates[tabId] || DEFAULT_TAB_AUTOMATION
      return {
        tabStates: {
          ...s.tabStates,
          [tabId]: { ...ts, currentCommandIndex: ts.currentCommandIndex + 1 }
        }
      }
    })
  },

  setChapterFilter: (tabId, chapters) => {
    set((s) => ({
      tabStates: {
        ...s.tabStates,
        [tabId]: {
          ...(s.tabStates[tabId] || DEFAULT_TAB_AUTOMATION),
          chapterFilter: chapters
        }
      }
    }))
  },

  assignCommandsToTab: (tabId) => {
    const { commands, tabStates } = get()
    const tabState = tabStates[tabId] || DEFAULT_TAB_AUTOMATION
    const { chapterFilter } = tabState

    set({
      commands: commands.map((cmd) => {
        if (cmd.tabId !== null) return cmd
        if (chapterFilter && !chapterFilter.includes(cmd.chapter)) return cmd
        return { ...cmd, tabId }
      })
    })
  },

  getFilteredCommands: (tabId) => {
    const { commands, tabStates } = get()
    if (!tabId) return commands

    const tabState = tabStates[tabId] || DEFAULT_TAB_AUTOMATION
    const { chapterFilter } = tabState

    return commands.filter((cmd) => {
      if (cmd.tabId !== null && cmd.tabId !== tabId) return false
      if (chapterFilter && !chapterFilter.includes(cmd.chapter)) return false
      return true
    })
  },

  getProgress: (tabId) => {
    const { commands } = get()
    const relevantCmds = tabId
      ? commands.filter((c) => c.tabId === tabId)
      : commands
    const completed = relevantCmds.filter((c) => c.status === 'done').length
    const failed = relevantCmds.filter((c) => c.status === 'failed').length
    const total = relevantCmds.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { completed, failed, total, percentage }
  }
}))
