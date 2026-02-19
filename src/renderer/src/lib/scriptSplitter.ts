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

    const chunks = splitLongSentence(trimmed)

    for (const chunk of chunks) {
      if (currentText && (currentText + ' ' + chunk).length > MAX_BLOCK_CHARS) {
        blocks.push(createBlock(currentText, blocks.length))
        currentText = chunk
      } else {
        currentText = currentText ? currentText + ' ' + chunk : chunk
      }
    }
  }

  if (currentText) {
    blocks.push(createBlock(currentText, blocks.length))
  }

  return recalculateTimings(blocks)
}

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_BLOCK_CHARS) return [sentence]

  const chunks: string[] = []
  const clauses = sentence.split(/,\s*/)
  let current = ''

  for (const clause of clauses) {
    if (clause.length > MAX_BLOCK_CHARS) {
      if (current) {
        chunks.push(current)
        current = ''
      }
      const words = clause.split(/\s+/)
      let wordChunk = ''
      for (const word of words) {
        if (wordChunk && (wordChunk + ' ' + word).length > MAX_BLOCK_CHARS) {
          chunks.push(wordChunk)
          wordChunk = word
        } else {
          wordChunk = wordChunk ? wordChunk + ' ' + word : word
        }
      }
      if (wordChunk) current = wordChunk
    } else if (current && (current + ', ' + clause).length > MAX_BLOCK_CHARS) {
      chunks.push(current)
      current = clause
    } else {
      current = current ? current + ', ' + clause : clause
    }
  }

  if (current) chunks.push(current)
  return chunks
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
    linkedAudioId: null,
    textMaterialId: null,
    textSegmentId: null
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
