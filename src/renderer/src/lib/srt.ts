import { msToSrtTime } from './time'

interface SrtBlock {
  index: number
  text: string
  startMs: number
  endMs: number
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
