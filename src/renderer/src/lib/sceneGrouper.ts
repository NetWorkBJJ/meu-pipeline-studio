import { v4 as uuidv4 } from 'uuid'

interface StoryBlock {
  id: string
  index: number
  text: string
  startMs: number
  endMs: number
  durationMs: number
}

interface Scene {
  id: string
  index: number
  description: string
  startMs: number
  endMs: number
  durationMs: number
  mediaKeyword: string
  mediaType: 'video' | 'photo'
  mediaPath: string | null
  blockIds: string[]
}

export function autoGroupScenes(blocks: StoryBlock[], blocksPerScene: number = 3): Scene[] {
  if (blocks.length === 0) return []

  const sorted = [...blocks].sort((a, b) => a.index - b.index)
  const scenes: Scene[] = []

  for (let i = 0; i < sorted.length; i += blocksPerScene) {
    const group = sorted.slice(i, i + blocksPerScene)
    const first = group[0]
    const last = group[group.length - 1]

    scenes.push({
      id: uuidv4(),
      index: scenes.length + 1,
      description: group
        .map((b) => b.text)
        .join(' ')
        .slice(0, 100),
      startMs: first.startMs,
      endMs: last.endMs,
      durationMs: last.endMs - first.startMs,
      mediaKeyword: '',
      mediaType: 'video',
      mediaPath: null,
      blockIds: group.map((b) => b.id)
    })
  }

  return scenes
}
