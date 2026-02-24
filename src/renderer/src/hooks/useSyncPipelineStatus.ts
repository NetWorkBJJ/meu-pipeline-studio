import { useEffect, useRef } from 'react'
import { useStageStore } from '@/stores/useStageStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

/**
 * Syncs pipeline stage completions between useStageStore (in-memory) and
 * useWorkspaceStore (persisted). Handles both directions:
 * - LOAD: When a project is opened, restore completed stages from workspace
 * - SAVE: When stages are completed, persist to workspace for project cards
 */
export function useSyncPipelineStatus(): void {
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const completedStages = useStageStore((s) => s.completedStages)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const audioBlocks = useProjectStore((s) => s.audioBlocks)
  const scenes = useProjectStore((s) => s.scenes)
  const { savePipelineStatus, loadPipelineStatus } = useWorkspaceStore()

  const prevPathRef = useRef<string | null>(null)
  const skipNextSaveRef = useRef(false)

  // LOAD: When project path changes, restore persisted stage data
  useEffect(() => {
    if (!capCutDraftPath || capCutDraftPath === prevPathRef.current) return
    prevPathRef.current = capCutDraftPath

    loadPipelineStatus(capCutDraftPath).then((status) => {
      if (status && status.completedStages.length > 0) {
        skipNextSaveRef.current = true
        const store = useStageStore.getState()
        store.reset()
        for (const stage of status.completedStages) {
          store.completeStage(stage)
        }
        if (status.lastStage > 0) {
          store.setFreeNavigation(true)
          store.setCurrentStage(status.lastStage)
          store.setFreeNavigation(false)
        }
      }
    })
  }, [capCutDraftPath, loadPipelineStatus])

  // SAVE: When completedStages changes, persist to workspace
  useEffect(() => {
    if (!capCutDraftPath || completedStages.size === 0) return

    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }

    const currentStage = useStageStore.getState().currentStage

    savePipelineStatus(capCutDraftPath, {
      completedStages: [...completedStages].sort(),
      lastStage: currentStage,
      lastRunAt: new Date().toISOString(),
      scriptBlockCount: storyBlocks.length,
      audioBlockCount: audioBlocks.length,
      sceneCount: scenes.length
    })
  }, [capCutDraftPath, completedStages, savePipelineStatus, storyBlocks.length, audioBlocks.length, scenes.length])
}
