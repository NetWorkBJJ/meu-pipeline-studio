import { msToSrtTime } from './time'

export interface SrtBlock {
  index: number
  text: string
  startMs: number
  endMs: number
}

export interface SrtMatchResult {
  blockId: string
  blockIndex: number
  startMs: number
  endMs: number
  durationMs: number
  srtIndices: number[]
}

export function blocksToSrt(blocks: SrtBlock[]): string {
  return blocks
    .map(
      (block) =>
        `${block.index}\n${msToSrtTime(block.startMs)} --> ${msToSrtTime(block.endMs)}\n${block.text}`
    )
    .join('\n\n')
}

export function parseSrt(srt: string): SrtBlock[] {
  const blocks: SrtBlock[] = []
  const parts = srt.trim().split(/\n\s*\n/)

  for (const part of parts) {
    const lines = part.trim().split('\n')
    if (lines.length < 3) continue

    const index = parseInt(lines[0], 10)
    if (isNaN(index)) continue

    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    )
    if (!timeMatch) continue

    const startMs =
      parseInt(timeMatch[1]) * 3600000 +
      parseInt(timeMatch[2]) * 60000 +
      parseInt(timeMatch[3]) * 1000 +
      parseInt(timeMatch[4])

    const endMs =
      parseInt(timeMatch[5]) * 3600000 +
      parseInt(timeMatch[6]) * 60000 +
      parseInt(timeMatch[7]) * 1000 +
      parseInt(timeMatch[8])

    const text = lines.slice(2).join('\n')

    blocks.push({ index, text, startMs, endMs })
  }

  return blocks
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchSrtToBlocks(
  srtBlocks: SrtBlock[],
  storyBlocks: Array<{ id: string; index: number; text: string }>
): SrtMatchResult[] {
  if (srtBlocks.length === 0 || storyBlocks.length === 0) return []

  const sorted = [...storyBlocks].sort((a, b) => a.index - b.index)

  // Build concatenated reference text (same as what was sent to TTS)
  const blockTexts = sorted.map((b) => b.text.trim())
  const fullText = blockTexts.join('\n\n')
  const normalizedFull = normalize(fullText)

  // Compute character ranges for each block in the normalized text
  interface BlockRange {
    id: string
    index: number
    charStart: number
    charEnd: number
  }
  const normalizedBlockTexts = blockTexts.map((t) => normalize(t))
  const ranges: BlockRange[] = []
  let rangesCursor = 0
  for (let i = 0; i < sorted.length; i++) {
    const nText = normalizedBlockTexts[i]
    const pos = normalizedFull.indexOf(nText, rangesCursor)
    if (pos >= 0) {
      ranges.push({
        id: sorted[i].id,
        index: sorted[i].index,
        charStart: pos,
        charEnd: pos + nText.length
      })
      rangesCursor = pos + nText.length
    } else {
      // Fallback: estimate position proportionally
      const ratio = i / sorted.length
      const estStart = Math.floor(ratio * normalizedFull.length)
      ranges.push({
        id: sorted[i].id,
        index: sorted[i].index,
        charStart: estStart,
        charEnd: estStart + nText.length
      })
    }
  }

  // Map SRT entries to blocks via position in normalized text
  const srtAssignments = new Map<number, number[]>()
  for (let i = 0; i < sorted.length; i++) {
    srtAssignments.set(i, [])
  }

  let searchCursor = 0
  for (let si = 0; si < srtBlocks.length; si++) {
    const srtText = normalize(srtBlocks[si].text)
    if (!srtText) continue

    const pos = normalizedFull.indexOf(srtText, searchCursor)
    if (pos === -1) continue

    searchCursor = pos + srtText.length
    const midpoint = pos + Math.floor(srtText.length / 2)

    // Find containing block
    let bestIdx = ranges.length - 1
    for (let ri = 0; ri < ranges.length; ri++) {
      if (midpoint >= ranges[ri].charStart && midpoint < ranges[ri].charEnd) {
        bestIdx = ri
        break
      }
      // If midpoint is between two blocks, assign to the closer one
      if (ri < ranges.length - 1 && midpoint < ranges[ri + 1].charStart) {
        const distToCurrent = midpoint - ranges[ri].charEnd
        const distToNext = ranges[ri + 1].charStart - midpoint
        bestIdx = distToCurrent <= distToNext ? ri : ri + 1
        break
      }
    }

    srtAssignments.get(bestIdx)!.push(si)
  }

  // Aggregate timing per block
  const results: SrtMatchResult[] = sorted.map((block, i) => {
    const indices = srtAssignments.get(i) || []
    if (indices.length > 0) {
      const startMs = Math.min(...indices.map((idx) => srtBlocks[idx].startMs))
      const endMs = Math.max(...indices.map((idx) => srtBlocks[idx].endMs))
      return {
        blockId: block.id,
        blockIndex: block.index,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        srtIndices: indices
      }
    }
    return {
      blockId: block.id,
      blockIndex: block.index,
      startMs: -1,
      endMs: -1,
      durationMs: 0,
      srtIndices: []
    }
  })

  // Interpolate gaps (blocks with no SRT matches)
  for (let i = 0; i < results.length; i++) {
    if (results[i].startMs >= 0) continue

    const prevEnd = i > 0 && results[i - 1].endMs >= 0 ? results[i - 1].endMs : 0
    let nextStart = -1
    for (let j = i + 1; j < results.length; j++) {
      if (results[j].startMs >= 0) {
        nextStart = results[j].startMs
        break
      }
    }
    if (nextStart < 0 && results.length > 0) {
      // Use the last known endMs from any matched block
      const lastMatched = results.filter((r) => r.endMs >= 0)
      nextStart = lastMatched.length > 0 ? lastMatched[lastMatched.length - 1].endMs : 0
    }

    results[i].startMs = prevEnd
    results[i].endMs = nextStart >= prevEnd ? nextStart : prevEnd
    results[i].durationMs = results[i].endMs - results[i].startMs
  }

  return results
}
