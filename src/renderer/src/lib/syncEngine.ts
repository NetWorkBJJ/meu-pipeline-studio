interface StoryBlock {
  id: string
  index: number
  text: string
  startMs: number
  endMs: number
  durationMs: number
  characterCount: number
  linkedAudioId: string | null
  textMaterialId: string | null
  textSegmentId: string | null
}

interface AudioBlock {
  id: string
  index: number
  startMs: number
  endMs: number
  durationMs: number
  linkedBlockId?: string | null
}

interface SyncResult {
  syncedBlocks: StoryBlock[]
  linkedCount: number
  unlinkedCount: number
}

export interface AudioAnalysis {
  trackCount: number
  gapCount: number
  totalGapMs: number
  isClean: boolean
  mismatch: number
}

export function analyzeAudioState(
  audioBlocks: AudioBlock[],
  storyBlockCount: number
): AudioAnalysis {
  if (audioBlocks.length === 0) {
    return { trackCount: 0, gapCount: 0, totalGapMs: 0, isClean: true, mismatch: storyBlockCount }
  }

  const sorted = [...audioBlocks].sort((a, b) => a.startMs - b.startMs)

  // Count gaps between consecutive audio blocks
  let gapCount = 0
  let totalGapMs = 0
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startMs - sorted[i - 1].endMs
    if (gap > 50) {
      // 50ms tolerance for floating point
      gapCount++
      totalGapMs += gap
    }
  }

  // Count unique tracks (using trackIndex field from raw data if available)
  const trackIndices = new Set<number>()
  for (const block of audioBlocks) {
    const raw = block as unknown as { trackIndex?: number }
    if (typeof raw.trackIndex === 'number') {
      trackIndices.add(raw.trackIndex)
    }
  }
  const trackCount = trackIndices.size > 0 ? trackIndices.size : 1

  return {
    trackCount,
    gapCount,
    totalGapMs: Math.round(totalGapMs),
    isClean: trackCount <= 1 && gapCount === 0,
    mismatch: storyBlockCount - audioBlocks.length
  }
}

export function autoSyncBlocks(storyBlocks: StoryBlock[], audioBlocks: AudioBlock[]): SyncResult {
  const sorted = [...storyBlocks].sort((a, b) => a.index - b.index)
  const audioSorted = [...audioBlocks].sort((a, b) => a.startMs - b.startMs)

  console.log(
    '[SyncEngine] autoSyncBlocks: storyBlocks=',
    sorted.length,
    'audioBlocks=',
    audioSorted.length,
    'hasLinkedIds=',
    audioBlocks.some((ab) => ab.linkedBlockId)
  )

  // Transcript-based: if audio blocks have linkedBlockId, use direct ID matching
  const hasLinkedIds = audioBlocks.some((ab) => ab.linkedBlockId)
  if (hasLinkedIds) {
    const linkedMap = new Map<string, AudioBlock>()
    for (const ab of audioBlocks) {
      if (ab.linkedBlockId) linkedMap.set(ab.linkedBlockId, ab)
    }
    let linkedCount = 0
    const synced = sorted.map((block) => {
      const audio = linkedMap.get(block.id)
      if (audio) {
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
    console.log('[SyncEngine] Case 1 (transcript): linked=', linkedCount, 'unlinked=', sorted.length - linkedCount)
    return { syncedBlocks: synced, linkedCount, unlinkedCount: sorted.length - linkedCount }
  }

  // Single audio block covering multiple story blocks: distribute proportionally
  if (audioSorted.length === 1 && sorted.length > 1) {
    const audio = audioSorted[0]
    const totalChars = sorted.reduce((sum, b) => sum + Math.max(b.characterCount, 1), 0)
    let cursor = audio.startMs
    const synced = sorted.map((block, i) => {
      const chars = Math.max(block.characterCount, 1)
      const isLast = i === sorted.length - 1
      const durationMs = isLast
        ? audio.endMs - cursor
        : Math.round((chars / totalChars) * audio.durationMs)
      const startMs = cursor
      const endMs = startMs + durationMs
      cursor = endMs
      return {
        ...block,
        startMs,
        endMs,
        durationMs,
        linkedAudioId: audio.id
      }
    })
    console.log('[SyncEngine] Case 2 (proportional): all', sorted.length, 'blocks linked, audio duration=', audio.durationMs)
    return { syncedBlocks: synced, linkedCount: sorted.length, unlinkedCount: 0 }
  }

  // Default: 1:1 index matching
  console.log('[SyncEngine] Case 3 (1:1 index): audioBlocks=', audioSorted.length, 'storyBlocks=', sorted.length)
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
