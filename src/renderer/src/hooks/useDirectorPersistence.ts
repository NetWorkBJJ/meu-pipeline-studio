import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/stores/useProjectStore'

const DEBOUNCE_MS = 1500

function buildSnapshot(
  state: ReturnType<typeof useProjectStore.getState>
): string {
  return JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    draftPath: state.capCutDraftPath,
    rawScript: state.rawScript,
    scenes: state.scenes,
    storyBlocks: state.storyBlocks,
    audioBlocks: state.audioBlocks,
    directorConfig: state.directorConfig,
    characterRefs: state.characterRefs
  })
}

function saveSnapshot(draftPath: string, data: string): void {
  window.api.saveDirectorState(draftPath, data).catch(() => {
    // Silent fail - persistence is best-effort
  })
}

export function useDirectorPersistence(): void {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced auto-save on state changes
  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state, prevState) => {
      // Trigger when any director-related field changes
      if (
        state.scenes === prevState.scenes &&
        state.rawScript === prevState.rawScript &&
        state.storyBlocks === prevState.storyBlocks &&
        state.audioBlocks === prevState.audioBlocks &&
        state.characterRefs === prevState.characterRefs
      ) return

      const { capCutDraftPath, scenes, storyBlocks, audioBlocks } = state
      const hasData = scenes.length > 0 || storyBlocks.length > 0 || audioBlocks.length > 0
      if (!capCutDraftPath || !hasData) return

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      debounceTimer.current = setTimeout(() => {
        saveSnapshot(capCutDraftPath, buildSnapshot(state))
      }, DEBOUNCE_MS)
    })

    return (): void => {
      unsubscribe()
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  // Immediate save on window close
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      const state = useProjectStore.getState()
      const { capCutDraftPath, scenes, storyBlocks, audioBlocks } = state
      const hasData = scenes.length > 0 || storyBlocks.length > 0 || audioBlocks.length > 0
      if (!capCutDraftPath || !hasData) return
      saveSnapshot(capCutDraftPath, buildSnapshot(state))
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
}

export function saveDirectorNow(): void {
  const state = useProjectStore.getState()
  const { capCutDraftPath, scenes, storyBlocks, audioBlocks } = state
  const hasData = scenes.length > 0 || storyBlocks.length > 0 || audioBlocks.length > 0
  if (!capCutDraftPath || !hasData) return
  saveSnapshot(capCutDraftPath, buildSnapshot(state))
}
