export interface StoryBlock {
  id: string
  index: number
  text: string
  startMs: number
  endMs: number
  durationMs: number
  characterCount: number
  linkedAudioId: string | null
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
