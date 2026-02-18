import { v4 as uuidv4 } from 'uuid'
import { CHARS_PER_SECOND, MAX_BLOCK_CHARS, MIN_BLOCK_DURATION_MS } from './constants'
import type { StoryBlock } from '@/types/project'

export function splitScriptIntoBlocks(rawScript: string): StoryBlock[] {
  const cleaned = rawScript.trim().replace(/\r\n/g, '\n')
  if (!cleaned) return []

  const sentences = cleaned.split(/(?<=[.!?])\s+/)
  const blocks: StoryBlock[] = []
  let currentText = ''

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    if (currentText && (currentText + ' ' + trimmed).length > MAX_BLOCK_CHARS) {
      blocks.push(createBlock(currentText, blocks.length))
      currentText = trimmed
    } else {
      currentText = currentText ? currentText + ' ' + trimmed : trimmed
    }
  }

  if (currentText) {
    blocks.push(createBlock(currentText, blocks.length))
  }

  return recalculateTimings(blocks)
}

function createBlock(text: string, index: number): StoryBlock {
  const charCount = text.length
  const durationMs = Math.max(
    MIN_BLOCK_DURATION_MS,
    Math.round((charCount / CHARS_PER_SECOND) * 1000)
  )

  return {
    id: uuidv4(),
    index,
    text,
    startMs: 0,
    endMs: durationMs,
    durationMs,
    characterCount: charCount,
    linkedAudioId: null
  }
}

export function recalculateTimings(blocks: StoryBlock[]): StoryBlock[] {
  let currentMs = 0
  return blocks.map((block, i) => {
    const durationMs = Math.max(
      MIN_BLOCK_DURATION_MS,
      Math.round((block.text.length / CHARS_PER_SECOND) * 1000)
    )
    const startMs = currentMs
    const endMs = currentMs + durationMs
    currentMs = endMs
    return {
      ...block,
      index: i + 1,
      startMs,
      endMs,
      durationMs,
      characterCount: block.text.length
    }
  })
}
