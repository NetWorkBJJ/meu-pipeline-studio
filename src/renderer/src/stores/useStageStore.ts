import { create } from 'zustand'

interface StageState {
  currentStage: number
  completedStages: Set<number>

  setCurrentStage: (stage: number) => void
  completeStage: (stage: number) => void
  invalidateFrom: (stage: number) => void
  canNavigateTo: (stage: number) => boolean
  reset: () => void
}

export const useStageStore = create<StageState>((set, get) => ({
  currentStage: 1,
  completedStages: new Set<number>(),

  setCurrentStage: (stage): void => {
    const { canNavigateTo } = get()
    if (canNavigateTo(stage)) {
      set({ currentStage: stage })
    }
  },

  completeStage: (stage): void =>
    set((state) => {
      const next = new Set(state.completedStages)
      next.add(stage)
      return { completedStages: next }
    }),

  invalidateFrom: (stage): void =>
    set((state) => {
      const next = new Set(state.completedStages)
      for (let i = stage; i <= 6; i++) {
        next.delete(i)
      }
      return { completedStages: next }
    }),

  canNavigateTo: (stage): boolean => {
    if (stage === 1) return true
    return get().completedStages.has(stage - 1)
  },

  reset: (): void => set({ currentStage: 1, completedStages: new Set<number>() })
}))
