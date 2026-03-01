import { describe, it, expect } from 'vitest'
import { analyzeAudioState, autoSyncBlocks } from '@/lib/syncEngine'

function makeStoryBlock(index: number, startMs = 0, endMs = 5000) {
  return {
    id: `story-${index}`,
    index,
    text: `Block ${index} text content.`,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    characterCount: 20,
    linkedAudioId: null,
    textMaterialId: null,
    textSegmentId: null
  }
}

function makeAudioBlock(index: number, startMs: number, endMs: number) {
  return {
    id: `audio-${index}`,
    index,
    startMs,
    endMs,
    durationMs: endMs - startMs
  }
}

describe('autoSyncBlocks', () => {
  it('links all blocks when counts match', () => {
    const story = [makeStoryBlock(1), makeStoryBlock(2), makeStoryBlock(3)]
    const audio = [
      makeAudioBlock(1, 0, 4000),
      makeAudioBlock(2, 4000, 9000),
      makeAudioBlock(3, 9000, 14000)
    ]
    const result = autoSyncBlocks(story, audio)
    expect(result.linkedCount).toBe(3)
    expect(result.unlinkedCount).toBe(0)
  })

  it('leaves unlinked when fewer audio blocks', () => {
    const story = [makeStoryBlock(1), makeStoryBlock(2), makeStoryBlock(3)]
    const audio = [makeAudioBlock(1, 0, 4000), makeAudioBlock(2, 4000, 9000)]
    const result = autoSyncBlocks(story, audio)
    expect(result.linkedCount).toBe(2)
    expect(result.unlinkedCount).toBe(1)
  })

  it('applies audio timings to synced blocks', () => {
    const story = [makeStoryBlock(1, 0, 5000)]
    const audio = [makeAudioBlock(1, 100, 4500)]
    const result = autoSyncBlocks(story, audio)
    expect(result.syncedBlocks[0].startMs).toBe(100)
    expect(result.syncedBlocks[0].endMs).toBe(4500)
    expect(result.syncedBlocks[0].durationMs).toBe(4400)
  })

  it('preserves text after sync', () => {
    const story = [makeStoryBlock(1), makeStoryBlock(2)]
    const audio = [makeAudioBlock(1, 0, 3000), makeAudioBlock(2, 3000, 7000)]
    const result = autoSyncBlocks(story, audio)
    expect(result.syncedBlocks[0].text).toBe('Block 1 text content.')
    expect(result.syncedBlocks[1].text).toBe('Block 2 text content.')
  })

  it('sets linkedAudioId on linked blocks', () => {
    const story = [makeStoryBlock(1)]
    const audio = [makeAudioBlock(1, 0, 5000)]
    const result = autoSyncBlocks(story, audio)
    expect(result.syncedBlocks[0].linkedAudioId).toBe('audio-1')
  })

  it('sets linkedAudioId null for unlinked blocks', () => {
    const story = [makeStoryBlock(1), makeStoryBlock(2)]
    const audio = [makeAudioBlock(1, 0, 5000)]
    const result = autoSyncBlocks(story, audio)
    expect(result.syncedBlocks[1].linkedAudioId).toBeNull()
  })
})

describe('analyzeAudioState', () => {
  it('returns clean state for empty audio', () => {
    const result = analyzeAudioState([], 5)
    expect(result.trackCount).toBe(0)
    expect(result.gapCount).toBe(0)
    expect(result.isClean).toBe(true)
    expect(result.mismatch).toBe(5)
  })

  it('detects gaps between audio blocks', () => {
    const audio = [
      makeAudioBlock(1, 0, 3000),
      makeAudioBlock(2, 3500, 7000) // 500ms gap
    ]
    const result = analyzeAudioState(audio, 2)
    expect(result.gapCount).toBe(1)
    expect(result.totalGapMs).toBe(500)
    expect(result.isClean).toBe(false)
  })

  it('calculates mismatch count', () => {
    const audio = [makeAudioBlock(1, 0, 5000)]
    const result = analyzeAudioState(audio, 5)
    expect(result.mismatch).toBe(4)
  })
})
