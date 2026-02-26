import { create } from 'zustand'
import type { FlowCommand, FlowCommandStatus, FlowCharacterImageRef } from '@/types/veo3'
import { buildFlowCommands } from '@/lib/flowCommandBuilder'
import { useProjectStore } from './useProjectStore'

interface Veo3AutomationState {
  commands: FlowCommand[]
  isRunning: boolean
  isPaused: boolean
  currentCommandIndex: number
  startedAt: number | null
  error: string | null
  chapterFilter: number[] | null

  loadFromProject: () => void
  updateCommandStatus: (commandId: string, status: FlowCommandStatus, error?: string) => void
  advanceToNext: () => void
  setChapterFilter: (chapters: number[] | null) => void
  updateCharacterGalleryName: (characterId: string, galleryItemName: string) => void
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: () => void
  getProgress: () => { completed: number; failed: number; total: number; percentage: number }
  getFilteredCommands: () => FlowCommand[]
}

const initialState = {
  commands: [] as FlowCommand[],
  isRunning: false,
  isPaused: false,
  currentCommandIndex: 0,
  startedAt: null as number | null,
  error: null as string | null,
  chapterFilter: null as number[] | null
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

  advanceToNext: () => {
    set((s) => ({ currentCommandIndex: s.currentCommandIndex + 1 }))
  },

  setChapterFilter: (chapters) => {
    set({ chapterFilter: chapters })
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

  start: () => {
    set({ isRunning: true, isPaused: false, startedAt: Date.now(), error: null })
  },

  pause: () => {
    set({ isPaused: true })
  },

  resume: () => {
    set({ isPaused: false })
  },

  stop: () => {
    set({ isRunning: false, isPaused: false })
  },

  reset: () => {
    set(initialState)
  },

  getProgress: () => {
    const { commands } = get()
    const completed = commands.filter((c) => c.status === 'done').length
    const failed = commands.filter((c) => c.status === 'failed').length
    const total = commands.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { completed, failed, total, percentage }
  },

  getFilteredCommands: () => {
    const { commands, chapterFilter } = get()
    if (!chapterFilter || chapterFilter.length === 0) return commands
    return commands.filter((cmd) => chapterFilter.includes(cmd.chapter))
  }
}))
