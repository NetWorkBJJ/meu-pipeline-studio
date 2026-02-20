export interface StoryBlock {
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

export interface AudioBlock {
  id: string
  index: number
  filePath: string
  startMs: number
  endMs: number
  durationMs: number
  linkedBlockId: string | null
  source: 'capcut' | 'tts' | 'external'
}

export interface Scene {
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

export interface VideoSegment {
  id: string
  index: number
  materialId: string
  filePath: string
  startMs: number
  endMs: number
  durationMs: number
  width: number
  height: number
  mediaType: 'video' | 'photo'
  trackIndex: number
}

export interface TrackInfo {
  index: number
  type: string
  id: string
  segmentCount: number
  durationMs: number
}

export interface ProjectSummary {
  name: string
  durationMs: number
  canvasWidth: number
  canvasHeight: number
  canvasRatio: string
  trackCount: number
  audioMaterialCount: number
  textMaterialCount: number
  videoMaterialCount: number
}

export interface Character {
  id: string
  name: string
  voiceId: string
  color: string
}

export interface MediaPreset {
  defaultType: 'video' | 'photo'
  defaultDurationMs: number
  transitionMs: number
}

export interface CapCutProjectInfo {
  name: string
  path: string
  draftPath: string
  modifiedUs: number
  createdUs: number
  durationUs: number
  materialsSize: number
  cover: string
  exists: boolean
  pipelineStatus: import('./workspace').PipelineStatus | null
  workspaceId: string | null
}

export interface Project {
  version: number
  name: string
  capCutDraftPath: string | null
  rawScript: string
  storyBlocks: StoryBlock[]
  audioBlocks: AudioBlock[]
  scenes: Scene[]
  characters: Character[]
  mediaPreset: MediaPreset
  createdAt: string
  updatedAt: string
}
