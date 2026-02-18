import { create } from 'zustand'

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
  filePath: string
  startMs: number
  endMs: number
  durationMs: number
  linkedBlockId: string | null
  source: 'capcut' | 'tts' | 'external'
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

interface MediaPreset {
  defaultType: 'video' | 'photo'
  defaultDurationMs: number
  transitionMs: number
}

interface ProjectState {
  capCutDraftPath: string | null
  rawScript: string
  storyBlocks: StoryBlock[]
  audioBlocks: AudioBlock[]
  scenes: Scene[]
  mediaPreset: MediaPreset

  setCapCutDraftPath: (path: string | null) => void
  setRawScript: (script: string) => void
  setStoryBlocks: (blocks: StoryBlock[]) => void
  updateStoryBlock: (id: string, updates: Partial<StoryBlock>) => void
  setAudioBlocks: (blocks: AudioBlock[]) => void
  updateAudioBlock: (id: string, updates: Partial<AudioBlock>) => void
  setScenes: (scenes: Scene[]) => void
  setMediaPreset: (preset: MediaPreset) => void
  resetProject: () => void
}

const initialState = {
  capCutDraftPath: null as string | null,
  rawScript: '',
  storyBlocks: [] as StoryBlock[],
  audioBlocks: [] as AudioBlock[],
  scenes: [] as Scene[],
  mediaPreset: {
    defaultType: 'video' as const,
    defaultDurationMs: 5000,
    transitionMs: 500
  }
}

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,

  setCapCutDraftPath: (path): void => set({ capCutDraftPath: path }),
  setRawScript: (script): void => set({ rawScript: script }),
  setStoryBlocks: (blocks): void => set({ storyBlocks: blocks }),
  updateStoryBlock: (id, updates): void =>
    set((state) => ({
      storyBlocks: state.storyBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
    })),
  setAudioBlocks: (blocks): void => set({ audioBlocks: blocks }),
  updateAudioBlock: (id, updates): void =>
    set((state) => ({
      audioBlocks: state.audioBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
    })),
  setScenes: (scenes): void => set({ scenes }),
  setMediaPreset: (preset): void => set({ mediaPreset: preset }),
  resetProject: (): void => set(initialState)
}))
