import { describe, it, expect } from 'vitest'
import { blocksToSrt, parseSrt } from '@/lib/srt'

const sampleBlocks = [
  { index: 1, text: 'First subtitle.', startMs: 0, endMs: 5000 },
  { index: 2, text: 'Second subtitle.', startMs: 5000, endMs: 10000 },
  { index: 3, text: 'Third subtitle.', startMs: 10000, endMs: 15000 }
]

describe('blocksToSrt', () => {
  it('produces valid SRT format with arrows', () => {
    const srt = blocksToSrt(sampleBlocks)
    expect(srt).toContain('-->')
    expect(srt).toContain('First subtitle.')
    expect(srt).toContain('00:00:00,000')
    expect(srt).toContain('00:00:05,000')
  })

  it('returns empty string for empty array', () => {
    expect(blocksToSrt([])).toBe('')
  })

  it('includes all blocks', () => {
    const srt = blocksToSrt(sampleBlocks)
    for (const block of sampleBlocks) {
      expect(srt).toContain(block.text)
    }
  })
})

describe('parseSrt', () => {
  it('roundtrips correctly', () => {
    const srt = blocksToSrt(sampleBlocks)
    const parsed = parseSrt(srt)
    expect(parsed.length).toBe(sampleBlocks.length)
    for (let i = 0; i < parsed.length; i++) {
      expect(parsed[i].index).toBe(sampleBlocks[i].index)
      expect(parsed[i].text).toBe(sampleBlocks[i].text)
      expect(parsed[i].startMs).toBe(sampleBlocks[i].startMs)
      expect(parsed[i].endMs).toBe(sampleBlocks[i].endMs)
    }
  })

  it('handles multiline text', () => {
    const srt = '1\n00:00:00,000 --> 00:00:05,000\nLine one\nLine two'
    const parsed = parseSrt(srt)
    expect(parsed.length).toBe(1)
    expect(parsed[0].text).toBe('Line one\nLine two')
  })

  it('skips invalid entries', () => {
    const srt = 'garbage\n\n1\n00:00:00,000 --> 00:00:05,000\nValid text'
    const parsed = parseSrt(srt)
    expect(parsed.length).toBe(1)
    expect(parsed[0].text).toBe('Valid text')
  })
})
