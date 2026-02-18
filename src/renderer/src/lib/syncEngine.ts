interface StoryBlock {
  id: string
  index: number
  text: string
  startMs: number
  endMs: number
  durationMs: number
  characterCount: number
  linkedAudioId: string | null
}

interface AudioBlock {
  id: string
  index: number
  startMs: number
  endMs: number
  durationMs: number
}

interface SyncResult {
  syncedBlocks: StoryBlock[]
  linkedCount: number
  unlinkedCount: number
}

export function autoSyncBlocks(storyBlocks: StoryBlock[], audioBlocks: AudioBlock[]): SyncResult {
  const sorted = [...storyBlocks].sort((a, b) => a.index - b.index)
  const audioSorted = [...audioBlocks].sort((a, b) => a.startMs - b.startMs)

  let linkedCount = 0
  const synced = sorted.map((block, i) => {
    if (i < audioSorted.length) {
      const audio = audioSorted[i]
      linkedCount++
      return {
        ...block,
        startMs: audio.startMs,
        endMs: audio.endMs,
        durationMs: audio.durationMs,
        linkedAudioId: audio.id
      }
    }
    return { ...block, linkedAudioId: null }
  })

  return {
    syncedBlocks: synced,
    linkedCount,
    unlinkedCount: sorted.length - linkedCount
  }
}
