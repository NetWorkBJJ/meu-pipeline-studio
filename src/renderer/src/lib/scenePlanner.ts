import { v4 as uuidv4 } from 'uuid'
import type {
  StoryBlock,
  Scene,
  DirectorConfig,
  GenerationStatus,
  MediaPlatform
} from '@/types/project'

export interface PlanResult {
  scenes: Scene[]
  statistics: {
    totalScenes: number
    videoCount: number
    imageCount: number
    avgDurationMs: number
    minDurationMs: number
    maxDurationMs: number
    coveragePercent: number
  }
}

export interface GapReport {
  missingScenes: Scene[]
  totalScenes: number
  coveredScenes: number
  coveragePercent: number
  timelineGaps: Array<{
    startMs: number
    endMs: number
    durationMs: number
    sceneIndices: number[]
  }>
}

// Chapter detection

export interface ChapterBoundary {
  chapter: number
  startMs: number
}

const WORD_TO_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  um: 1, dois: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10
}

const CHAPTER_PATTERNS = [
  /\bchapter\s+(\d+)\b/i,
  /\bchapter\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /\bcap[ií]tulo\s+(\d+)\b/i,
  /\bcap[ií]tulo\s+(um|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)\b/i
]

export function detectChapters(blocks: StoryBlock[]): ChapterBoundary[] {
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs)
  const boundaries: ChapterBoundary[] = []

  for (const block of sorted) {
    for (const pattern of CHAPTER_PATTERNS) {
      const match = block.text.match(pattern)
      if (match) {
        const raw = match[1].toLowerCase()
        const chapter = WORD_TO_NUM[raw] ?? parseInt(raw, 10)
        if (!isNaN(chapter) && !boundaries.some((b) => b.chapter === chapter)) {
          boundaries.push({ chapter, startMs: block.startMs })
        }
        break
      }
    }
  }

  return boundaries.sort((a, b) => a.startMs - b.startMs)
}

function assignChaptersToScenes(scenes: Scene[], blocks: StoryBlock[]): void {
  const chapters = detectChapters(blocks)
  for (const scene of scenes) {
    if (chapters.length === 0) {
      scene.chapter = 1
    } else {
      let ch = chapters[0].chapter
      for (const boundary of chapters) {
        if (scene.startMs >= boundary.startMs) ch = boundary.chapter
        else break
      }
      scene.chapter = ch
    }
  }
}

function seededRandom(seed: number): () => number {
  let t = seed + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function triangularRandom(rng: () => number, min: number, max: number): number {
  const mid = (min + max) / 2
  const u = rng()
  if (u < 0.5) {
    return min + Math.sqrt(u * 2 * (mid - min) * (max - min)) * ((mid - min) / (max - min))
  }
  return max - Math.sqrt((1 - u) * 2 * (max - mid) * (max - min)) * ((max - mid) / (max - min))
}

function getMediaType(
  index: number,
  total: number,
  mode: DirectorConfig['sequenceMode']
): 'video' | 'photo' {
  switch (mode) {
    case 'video-only':
      return 'video'
    case 'image-only':
      return 'photo'
    case 'alternating':
      return index % 2 === 0 ? 'video' : 'photo'
    case 'ai-decided':
      // Placeholder: will be overridden by LLM later
      return index < total / 2 ? 'video' : 'photo'
  }
}

function getPlatform(mediaType: 'video' | 'photo'): MediaPlatform {
  return mediaType === 'video' ? 'vo3' : 'nano-banana-pro'
}

function getDurationRange(
  mediaType: 'video' | 'photo',
  config: DirectorConfig
): [number, number] {
  if (mediaType === 'video') {
    return [config.videoMinDurationMs, config.videoMaxDurationMs]
  }
  return [config.imageMinDurationMs, config.imageMaxDurationMs]
}

export function planScenes(blocks: StoryBlock[], config: DirectorConfig): PlanResult {
  if (blocks.length === 0) {
    return {
      scenes: [],
      statistics: {
        totalScenes: 0,
        videoCount: 0,
        imageCount: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        coveragePercent: 0
      }
    }
  }

  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs)
  const timelineStart = sorted[0].startMs
  const timelineEnd = sorted[sorted.length - 1].endMs
  const totalDuration = timelineEnd - timelineStart

  if (totalDuration <= 0) {
    return {
      scenes: [],
      statistics: {
        totalScenes: 0,
        videoCount: 0,
        imageCount: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        coveragePercent: 0
      }
    }
  }

  const rng = seededRandom(config.variationSeed)

  // Estimate scene count based on average duration
  const avgMin =
    config.sequenceMode === 'image-only'
      ? config.imageMinDurationMs
      : config.sequenceMode === 'video-only'
        ? config.videoMinDurationMs
        : (config.videoMinDurationMs + config.imageMinDurationMs) / 2
  const avgMax =
    config.sequenceMode === 'image-only'
      ? config.imageMaxDurationMs
      : config.sequenceMode === 'video-only'
        ? config.videoMaxDurationMs
        : (config.videoMaxDurationMs + config.imageMaxDurationMs) / 2
  const avgDuration = (avgMin + avgMax) / 2
  const estimatedCount = Math.max(1, Math.round(totalDuration / avgDuration))

  // Assign media types
  const mediaTypes: Array<'video' | 'photo'> = []
  for (let i = 0; i < estimatedCount; i++) {
    mediaTypes.push(getMediaType(i, estimatedCount, config.sequenceMode))
  }

  // Generate target durations with non-linear variation
  const targetDurations: number[] = []
  for (let i = 0; i < estimatedCount; i++) {
    const [min, max] = getDurationRange(mediaTypes[i], config)
    targetDurations.push(triangularRandom(rng, min, max))
  }

  // Proportionally adjust to fit total duration
  const rawSum = targetDurations.reduce((a, b) => a + b, 0)
  const scale = totalDuration / rawSum
  for (let i = 0; i < targetDurations.length; i++) {
    targetDurations[i] = Math.round(targetDurations[i] * scale)
  }

  // Clamp back to valid ranges and redistribute excess
  let excess = 0
  for (let i = 0; i < targetDurations.length; i++) {
    const [min, max] = getDurationRange(mediaTypes[i], config)
    if (targetDurations[i] < min) {
      excess += targetDurations[i] - min
      targetDurations[i] = min
    } else if (targetDurations[i] > max) {
      excess += targetDurations[i] - max
      targetDurations[i] = max
    }
  }

  // Distribute excess evenly among scenes that can absorb it
  if (Math.abs(excess) > 0) {
    const direction = excess > 0 ? 1 : -1
    let remaining = Math.abs(excess)
    for (let pass = 0; pass < 3 && remaining > 0; pass++) {
      for (let i = 0; i < targetDurations.length && remaining > 0; i++) {
        const [min, max] = getDurationRange(mediaTypes[i], config)
        const room =
          direction > 0
            ? max - targetDurations[i]
            : targetDurations[i] - min
        if (room > 0) {
          const add = Math.min(remaining, Math.ceil(room / 2))
          targetDurations[i] += add * direction
          remaining -= add
        }
      }
    }
  }

  // Build scenes with timing
  const scenes: Scene[] = []
  let currentMs = timelineStart

  for (let i = 0; i < estimatedCount; i++) {
    const sceneStart = currentMs
    const sceneDuration = targetDurations[i]
    const sceneEnd = sceneStart + sceneDuration

    // Find blocks that overlap with this scene (>50% overlap)
    const sceneBlockIds: string[] = []
    for (const block of sorted) {
      const overlapStart = Math.max(block.startMs, sceneStart)
      const overlapEnd = Math.min(block.endMs, sceneEnd)
      const overlap = Math.max(0, overlapEnd - overlapStart)
      if (overlap > block.durationMs * 0.5) {
        sceneBlockIds.push(block.id)
      }
    }

    const sceneBlocks = sorted.filter((b) => sceneBlockIds.includes(b.id))
    const description = sceneBlocks
      .map((b) => b.text)
      .join(' ')
      .slice(0, 100)

    scenes.push({
      id: uuidv4(),
      index: i + 1,
      description,
      startMs: sceneStart,
      endMs: sceneEnd,
      durationMs: sceneDuration,
      mediaKeyword: '',
      mediaType: mediaTypes[i],
      mediaPath: null,
      blockIds: sceneBlockIds,
      prompt: '',
      promptRevision: 0,
      generationStatus: 'pending' as GenerationStatus,
      platform: getPlatform(mediaTypes[i]),
      filenameHint: `scene_${String(i + 1).padStart(3, '0')}`,
      narrativeContext: '',
      sceneType: '',
      llmMetadata: null,
      chapter: 1
    })

    currentMs = sceneEnd
  }

  // Detect and assign chapters from script text
  assignChaptersToScenes(scenes, sorted)

  // Statistics
  const durations = scenes.map((s) => s.durationMs)
  const videoCount = scenes.filter((s) => s.mediaType === 'video').length
  const imageCount = scenes.filter((s) => s.mediaType === 'photo').length
  const coveredMs = scenes.reduce((sum, s) => sum + s.durationMs, 0)

  return {
    scenes,
    statistics: {
      totalScenes: scenes.length,
      videoCount,
      imageCount,
      avgDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
      coveragePercent: Math.round((coveredMs / totalDuration) * 100)
    }
  }
}

export function detectGaps(scenes: Scene[]): GapReport {
  const missingScenes = scenes.filter((s) => !s.mediaPath)
  const coveredScenes = scenes.length - missingScenes.length
  const coveragePercent =
    scenes.length > 0 ? Math.round((coveredScenes / scenes.length) * 100) : 0

  // Find contiguous gap regions
  const timelineGaps: GapReport['timelineGaps'] = []
  let currentGap: { startMs: number; endMs: number; sceneIndices: number[] } | null = null

  for (const scene of scenes) {
    if (!scene.mediaPath) {
      if (currentGap) {
        currentGap.endMs = scene.endMs
        currentGap.sceneIndices.push(scene.index)
      } else {
        currentGap = {
          startMs: scene.startMs,
          endMs: scene.endMs,
          sceneIndices: [scene.index]
        }
      }
    } else {
      if (currentGap) {
        timelineGaps.push({
          ...currentGap,
          durationMs: currentGap.endMs - currentGap.startMs
        })
        currentGap = null
      }
    }
  }

  if (currentGap) {
    timelineGaps.push({
      ...currentGap,
      durationMs: currentGap.endMs - currentGap.startMs
    })
  }

  return {
    missingScenes,
    totalScenes: scenes.length,
    coveredScenes,
    coveragePercent,
    timelineGaps
  }
}
