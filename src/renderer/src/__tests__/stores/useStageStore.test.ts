import { describe, it, expect, beforeEach } from 'vitest'
import { useStageStore } from '@/stores/useStageStore'

describe('useStageStore', () => {
  beforeEach(() => {
    useStageStore.getState().reset()
  })

  it('initial stage is 1', () => {
    expect(useStageStore.getState().currentStage).toBe(1)
  })

  it('completing stage enables next', () => {
    const store = useStageStore.getState()
    store.completeStage(1)
    expect(store.canNavigateTo(2)).toBe(true)
  })

  it('cannot skip stages without completion', () => {
    const store = useStageStore.getState()
    expect(store.canNavigateTo(3)).toBe(false)
  })

  it('free navigation bypasses completion check', () => {
    const store = useStageStore.getState()
    store.setFreeNavigation(true)
    expect(store.canNavigateTo(3)).toBe(true)
    expect(store.canNavigateTo(4)).toBe(true)
  })

  it('invalidateFrom removes later stages', () => {
    const store = useStageStore.getState()
    store.completeStage(1)
    store.completeStage(2)
    store.completeStage(3)
    store.invalidateFrom(2)
    expect(useStageStore.getState().completedStages.has(1)).toBe(true)
    expect(useStageStore.getState().completedStages.has(2)).toBe(false)
    expect(useStageStore.getState().completedStages.has(3)).toBe(false)
  })

  it('reset restores initial state', () => {
    const store = useStageStore.getState()
    store.completeStage(1)
    store.setCurrentStage(2)
    store.reset()
    const state = useStageStore.getState()
    expect(state.currentStage).toBe(1)
    expect(state.completedStages.size).toBe(0)
    expect(state.freeNavigation).toBe(false)
  })

  it('stage 5 is always accessible', () => {
    const store = useStageStore.getState()
    expect(store.canNavigateTo(5)).toBe(true)
  })
})
