import { describe, it, expect } from 'vitest'
import { autoGroupScenes } from '@/lib/sceneGrouper'

function makeBlock(index: number, startMs: number, endMs: number) {
  return {
    id: `block-${index}`,
    index,
    text: `Block ${index} text.`,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    characterCount: 15,
    linkedAudioId: `audio-${index}`,
    textMaterialId: null,
    textSegmentId: null
  }
}

describe('autoGroupScenes', () => {
  it('groups blocks by 3', () => {
    const blocks = Array.from({ length: 9 }, (_, i) =>
      makeBlock(i + 1, i * 5000, (i + 1) * 5000)
    )
    const scenes = autoGroupScenes(blocks, 3)
    expect(scenes.length).toBe(3)
    for (const scene of scenes) {
      expect(scene.blockIds.length).toBe(3)
    }
  })

  it('last group may have fewer blocks', () => {
    const blocks = Array.from({ length: 10 }, (_, i) =>
      makeBlock(i + 1, i * 5000, (i + 1) * 5000)
    )
    const scenes = autoGroupScenes(blocks, 3)
    expect(scenes.length).toBe(4)
    expect(scenes[3].blockIds.length).toBe(1)
  })

  it('returns empty for empty blocks', () => {
    expect(autoGroupScenes([])).toEqual([])
  })

  it('scenes have valid timings', () => {
    const blocks = Array.from({ length: 6 }, (_, i) =>
      makeBlock(i + 1, i * 5000, (i + 1) * 5000)
    )
    const scenes = autoGroupScenes(blocks, 3)
    for (const scene of scenes) {
      expect(scene.endMs).toBeGreaterThan(scene.startMs)
      expect(scene.durationMs).toBeGreaterThan(0)
    }
  })

  it('scenes contain correct block IDs', () => {
    const blocks = Array.from({ length: 6 }, (_, i) =>
      makeBlock(i + 1, i * 5000, (i + 1) * 5000)
    )
    const scenes = autoGroupScenes(blocks, 3)
    expect(scenes[0].blockIds).toEqual(['block-1', 'block-2', 'block-3'])
    expect(scenes[1].blockIds).toEqual(['block-4', 'block-5', 'block-6'])
  })

  it('default mediaType is video', () => {
    const blocks = [makeBlock(1, 0, 5000)]
    const scenes = autoGroupScenes(blocks)
    expect(scenes[0].mediaType).toBe('video')
  })
})
