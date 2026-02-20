import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useStageStore } from './useStageStore'

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

interface VideoSegment {
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

interface TrackInfo {
  index: number
  type: string
  id: string
  segmentCount: number
  durationMs: number
}

interface ProjectSummary {
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

interface TtsDefaults {
  voice: string
  style: string
  ttsModel: 'flash' | 'pro'
}

interface RawFullProjectResponse {
  summary: {
    name: string
    duration_ms: number
    canvas_config: { width: number; height: number; ratio: string }
    track_count: number
    audio_material_count: number
    text_material_count: number
    video_material_count: number
  }
  audio_segments: Array<{
    id: string
    material_id: string
    start_ms: number
    end_ms: number
    duration_ms: number
    file_path: string
    tone_type: string
    tone_platform: string
    track_index: number
  }>
  text_segments: Array<{
    index: number
    track_idx: number
    segment_idx: number
    segment_id: string
    material_id: string
    text: string
    start_ms: number
    end_ms: number
    duration_ms: number
  }>
  video_segments: Array<{
    id: string
    material_id: string
    start_ms: number
    end_ms: number
    duration_ms: number
    file_path: string
    width: number
    height: number
    media_type: string
    track_index: number
  }>
  tracks: Array<{
    index: number
    type: string
    id: string
    segment_count: number
    duration_ms: number
  }>
}

interface ProjectState {
  capCutDraftPath: string | null
  rawScript: string
  storyBlocks: StoryBlock[]
  audioBlocks: AudioBlock[]
  scenes: Scene[]
  videoSegments: VideoSegment[]
  trackOverview: TrackInfo[]
  projectSummary: ProjectSummary | null
  projectLoaded: boolean
  mediaPreset: MediaPreset
  ttsDefaults: TtsDefaults
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
  setVideoSegments: (segments: VideoSegment[]) => void
  setTrackOverview: (tracks: TrackInfo[]) => void
  setProjectSummary: (summary: ProjectSummary | null) => void
  setProjectLoaded: (loaded: boolean) => void
  loadFullProject: (draftPath: string) => Promise<void>
  setMediaPreset: (preset: MediaPreset) => void
  setTtsDefaults: (defaults: TtsDefaults) => void
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
  videoSegments: [] as VideoSegment[],
  trackOverview: [] as TrackInfo[],
  projectSummary: null as ProjectSummary | null,
  projectLoaded: false,
  mediaPreset: {
    defaultType: 'video' as const,
    defaultDurationMs: 5000,
    transitionMs: 500
  },
  ttsDefaults: {
    voice: 'Kore',
    style: 'Neutro',
    ttsModel: 'flash' as const
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
      setVideoSegments: (segments) => {
        set({ videoSegments: segments })
      },
      setTrackOverview: (tracks) => {
        set({ trackOverview: tracks })
      },
      setProjectSummary: (summary) => {
        set({ projectSummary: summary })
      },
      setProjectLoaded: (loaded) => {
        set({ projectLoaded: loaded })
      },
      loadFullProject: async (draftPath) => {
        try {
          const raw = (await window.api.loadFullProject(draftPath)) as RawFullProjectResponse

          const audioBlocks: AudioBlock[] = raw.audio_segments.map((seg, i) => ({
            id: seg.id || crypto.randomUUID(),
            index: i + 1,
            filePath: seg.file_path,
            startMs: seg.start_ms,
            endMs: seg.end_ms,
            durationMs: seg.duration_ms,
            linkedBlockId: null,
            source: 'capcut' as const
          }))

          const storyBlocks: StoryBlock[] = raw.text_segments.map((seg, i) => ({
            id: crypto.randomUUID(),
            index: i + 1,
            text: seg.text,
            startMs: seg.start_ms,
            endMs: seg.end_ms,
            durationMs: seg.duration_ms,
            characterCount: seg.text.length,
            linkedAudioId: null,
            textMaterialId: seg.material_id,
            textSegmentId: seg.segment_id || null
          }))

          const videoSegments: VideoSegment[] = raw.video_segments.map((seg, i) => ({
            id: seg.id || crypto.randomUUID(),
            index: i + 1,
            materialId: seg.material_id,
            filePath: seg.file_path,
            startMs: seg.start_ms,
            endMs: seg.end_ms,
            durationMs: seg.duration_ms,
            width: seg.width,
            height: seg.height,
            mediaType: (seg.media_type || 'video') as 'video' | 'photo',
            trackIndex: seg.track_index
          }))

          const trackOverview: TrackInfo[] = raw.tracks.map((t) => ({
            index: t.index,
            type: t.type,
            id: t.id,
            segmentCount: t.segment_count,
            durationMs: t.duration_ms
          }))

          const projectSummary: ProjectSummary = {
            name: raw.summary.name || '',
            durationMs: raw.summary.duration_ms,
            canvasWidth: raw.summary.canvas_config?.width || 0,
            canvasHeight: raw.summary.canvas_config?.height || 0,
            canvasRatio: raw.summary.canvas_config?.ratio || '',
            trackCount: raw.summary.track_count,
            audioMaterialCount: raw.summary.audio_material_count,
            textMaterialCount: raw.summary.text_material_count,
            videoMaterialCount: raw.summary.video_material_count
          }

          set({
            audioBlocks,
            storyBlocks,
            videoSegments,
            trackOverview,
            projectSummary,
            projectLoaded: true
          })

          // Enable free navigation when project has data loaded
          const hasData = storyBlocks.length > 0 || audioBlocks.length > 0 || videoSegments.length > 0
          if (hasData) {
            useStageStore.getState().setFreeNavigation(true)
          }
        } catch (error) {
          set({ projectLoaded: false })
          throw error
        }
      },
      setMediaPreset: (preset) => {
        set({ mediaPreset: preset })
      },
      setTtsDefaults: (defaults) => {
        set({ ttsDefaults: defaults })
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
        useStageStore.getState().setFreeNavigation(false)
      }
    }),
    {
      name: 'meu-pipeline-project',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mediaPreset: state.mediaPreset,
        ttsDefaults: state.ttsDefaults,
        recentProjects: state.recentProjects
      })
    }
  )
)
