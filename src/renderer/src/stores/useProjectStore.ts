import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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

interface RecentProject {
  name: string
  path: string
  lastOpened: number
}

interface CapCutProjectInfo {
  name: string
  path: string
  draftPath: string
  modifiedUs: number
  createdUs: number
  durationUs: number
  materialsSize: number
  cover: string
  exists: boolean
  pipelineStatus: unknown | null
  workspaceId: string | null
}

interface ProjectState {
  capCutDraftPath: string | null
  rawScript: string
  storyBlocks: StoryBlock[]
  audioBlocks: AudioBlock[]
  scenes: Scene[]
  mediaPreset: MediaPreset
  recentProjects: RecentProject[]
  capCutProjects: CapCutProjectInfo[]
  capCutProjectsLoading: boolean

  setCapCutDraftPath: (path: string | null) => void
  setRawScript: (script: string) => void
  setStoryBlocks: (blocks: StoryBlock[]) => void
  updateStoryBlock: (id: string, updates: Partial<StoryBlock>) => void
  setAudioBlocks: (blocks: AudioBlock[]) => void
  updateAudioBlock: (id: string, updates: Partial<AudioBlock>) => void
  setScenes: (scenes: Scene[]) => void
  setMediaPreset: (preset: MediaPreset) => void
  addRecentProject: (project: RecentProject) => void
  removeRecentProject: (path: string) => void
  fetchCapCutProjects: () => Promise<void>
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
  },
  recentProjects: [] as RecentProject[],
  capCutProjects: [] as CapCutProjectInfo[],
  capCutProjectsLoading: false
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      ...initialState,

      setCapCutDraftPath: (path) => {
        set({ capCutDraftPath: path })
      },
      setRawScript: (script) => {
        set({ rawScript: script })
      },
      setStoryBlocks: (blocks) => {
        set({ storyBlocks: blocks })
      },
      updateStoryBlock: (id, updates) => {
        set((state) => ({
          storyBlocks: state.storyBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
        }))
      },
      setAudioBlocks: (blocks) => {
        set({ audioBlocks: blocks })
      },
      updateAudioBlock: (id, updates) => {
        set((state) => ({
          audioBlocks: state.audioBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b))
        }))
      },
      setScenes: (scenes) => {
        set({ scenes })
      },
      setMediaPreset: (preset) => {
        set({ mediaPreset: preset })
      },
      addRecentProject: (project) => {
        set((state) => {
          const filtered = state.recentProjects.filter((p) => p.path !== project.path)
          return { recentProjects: [project, ...filtered].slice(0, 10) }
        })
      },
      removeRecentProject: (path) => {
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.path !== path)
        }))
      },
      fetchCapCutProjects: async () => {
        set({ capCutProjectsLoading: true })
        try {
          const raw = (await window.api.listCapCutProjects()) as Array<Record<string, unknown>>
          const projects: CapCutProjectInfo[] = raw.map((p) => ({
            name: (p.name as string) || '',
            path: (p.path as string) || '',
            draftPath: (p.draft_path as string) || '',
            modifiedUs: (p.modified_us as number) || 0,
            createdUs: (p.created_us as number) || 0,
            durationUs: (p.duration_us as number) || 0,
            materialsSize: (p.materials_size as number) || 0,
            cover: (p.cover as string) || '',
            exists: (p.exists as boolean) ?? true,
            pipelineStatus: null,
            workspaceId: null
          }))
          set({ capCutProjects: projects })
        } catch {
          set({ capCutProjects: [] })
        } finally {
          set({ capCutProjectsLoading: false })
        }
      },
      resetProject: () => {
        set((state) => ({
          ...initialState,
          recentProjects: state.recentProjects
        }))
      }
    }),
    {
      name: 'meu-pipeline-project',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mediaPreset: state.mediaPreset,
        recentProjects: state.recentProjects
      })
    }
  )
)
