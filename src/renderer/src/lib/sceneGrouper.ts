import { v4 as uuidv4 } from 'uuid'
import type { StoryBlock, Scene } from '@/types/project'

/**
 * @deprecated Use planScenes from scenePlanner.ts instead.
 * Kept for backward compatibility.
 */
export function autoGroupScenes(blocks: StoryBlock[], blocksPerScene: number = 3): Scene[] {
  if (blocks.length === 0) return []

  const sorted = [...blocks].sort((a, b) => a.index - b.index)
  const scenes: Scene[] = []

  for (let i = 0; i < sorted.length; i += blocksPerScene) {
    const group = sorted.slice(i, i + blocksPerScene)
    const first = group[0]
    const last = group[group.length - 1]
    const index = scenes.length + 1

    scenes.push({
      id: uuidv4(),
      index,
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
      blockIds: group.map((b) => b.id),
      prompt: '',
      promptRevision: 0,
      generationStatus: 'pending',
      platform: 'vo3',
      filenameHint: `scene_${String(index).padStart(3, '0')}`,
      narrativeContext: '',
      sceneType: '',
      llmMetadata: null
    })
  }

  return scenes
}
