import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore } from '@/stores/useProjectStore'

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it('initial state has empty storyBlocks', () => {
    expect(useProjectStore.getState().storyBlocks).toEqual([])
  })

  it('setStoryBlocks stores blocks correctly', () => {
    const blocks = [
      {
        id: 'b1',
        index: 1,
        text: 'Hello',
        startMs: 0,
        endMs: 1000,
        durationMs: 1000,
        characterCount: 5,
        linkedAudioId: null,
        textMaterialId: null,
        textSegmentId: null
      }
    ]
    useProjectStore.getState().setStoryBlocks(blocks)
    expect(useProjectStore.getState().storyBlocks).toEqual(blocks)
  })

  it('resetProject clears storyBlocks', () => {
    useProjectStore.getState().setStoryBlocks([
      {
        id: 'b1',
        index: 1,
        text: 'test',
        startMs: 0,
        endMs: 500,
        durationMs: 500,
        characterCount: 4,
        linkedAudioId: null,
        textMaterialId: null,
        textSegmentId: null
      }
    ])
    useProjectStore.getState().resetProject()
    expect(useProjectStore.getState().storyBlocks).toEqual([])
  })

  it('resetProject preserves recentProjects', () => {
    useProjectStore.getState().addRecentProject({
      name: 'Test Project',
      path: '/test/path',
      lastOpened: Date.now()
    })
    const recentBefore = useProjectStore.getState().recentProjects.length
    useProjectStore.getState().resetProject()
    expect(useProjectStore.getState().recentProjects.length).toBe(recentBefore)
  })

  it('projectLoaded flag works', () => {
    expect(useProjectStore.getState().projectLoaded).toBe(false)
    useProjectStore.getState().setProjectLoaded(true)
    expect(useProjectStore.getState().projectLoaded).toBe(true)
  })
})
