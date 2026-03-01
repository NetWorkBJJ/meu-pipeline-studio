import { describe, it, expect } from 'vitest'
import { splitScriptIntoBlocks, recalculateTimings } from '@/lib/scriptSplitter'

describe('splitScriptIntoBlocks', () => {
  it('returns empty array for empty script', () => {
    expect(splitScriptIntoBlocks('')).toEqual([])
  })

  it('returns empty array for whitespace only', () => {
    expect(splitScriptIntoBlocks('   \n\n  ')).toEqual([])
  })

  it('creates one block for short sentence', () => {
    const blocks = splitScriptIntoBlocks('Hello world.')
    expect(blocks.length).toBe(1)
    expect(blocks[0].text).toBe('Hello world.')
  })

  it('respects MAX_BLOCK_CHARS limit (80)', () => {
    const longScript =
      'The quick brown fox jumps over the lazy dog near the river bank. ' +
      'The cat sat on the mat watching the birds fly by the old oak tree. ' +
      'A gentle breeze was blowing through the valley on that warm afternoon.'
    const blocks = splitScriptIntoBlocks(longScript)
    for (const block of blocks) {
      expect(block.text.length).toBeLessThanOrEqual(80)
    }
  })

  it('produces sequential timings with no gaps', () => {
    const script =
      'First sentence here. Second sentence now. Third one follows.'
    const blocks = splitScriptIntoBlocks(script)
    for (let i = 0; i < blocks.length - 1; i++) {
      expect(blocks[i].endMs).toBe(blocks[i + 1].startMs)
    }
  })

  it('enforces minimum duration of 500ms', () => {
    const blocks = splitScriptIntoBlocks('Hi. Ok. Go.')
    for (const block of blocks) {
      expect(block.durationMs).toBeGreaterThanOrEqual(500)
    }
  })

  it('starts indices at 1', () => {
    const blocks = splitScriptIntoBlocks('First. Second. Third.')
    expect(blocks[0].index).toBe(1)
  })

  it('has sequential indices', () => {
    const blocks = splitScriptIntoBlocks('A long day. B long day. C long day.')
    for (let i = 0; i < blocks.length; i++) {
      expect(blocks[i].index).toBe(i + 1)
    }
  })

  it('sets characterCount matching text length', () => {
    const blocks = splitScriptIntoBlocks('Hello world, this is a test sentence.')
    for (const block of blocks) {
      expect(block.characterCount).toBe(block.text.length)
    }
  })

  it('splits long sentence on commas', () => {
    const sentence =
      'A very long clause with many words, another clause that continues for a while, and yet a third clause that extends.'
    const blocks = splitScriptIntoBlocks(sentence)
    expect(blocks.length).toBeGreaterThan(1)
    for (const block of blocks) {
      expect(block.text.length).toBeLessThanOrEqual(80)
    }
  })

  it('initializes linkedAudioId as null', () => {
    const blocks = splitScriptIntoBlocks('A simple test.')
    for (const block of blocks) {
      expect(block.linkedAudioId).toBeNull()
    }
  })
})

describe('recalculateTimings', () => {
  it('preserves text content', () => {
    const blocks = splitScriptIntoBlocks('First sentence. Second sentence.')
    const original = blocks.map((b) => b.text)
    const recalced = recalculateTimings(blocks)
    expect(recalced.map((b) => b.text)).toEqual(original)
  })

  it('produces sequential timings', () => {
    const blocks = splitScriptIntoBlocks('One. Two. Three.')
    const recalced = recalculateTimings(blocks)
    for (let i = 0; i < recalced.length - 1; i++) {
      expect(recalced[i].endMs).toBe(recalced[i + 1].startMs)
    }
  })

  it('reindexes starting at 1', () => {
    const blocks = splitScriptIntoBlocks('One. Two. Three.')
    const recalced = recalculateTimings(blocks)
    for (let i = 0; i < recalced.length; i++) {
      expect(recalced[i].index).toBe(i + 1)
    }
  })
})
