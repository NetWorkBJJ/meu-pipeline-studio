import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useStageStore } from './useStageStore'
import type {
  StoryBlock,
  AudioBlock,
  Scene,
  VideoSegment,
  TrackInfo,
  ProjectSummary,
  MediaPreset,
  CapCutProjectInfo,
  DirectorConfig,
  DirectorProgress,
  CharacterRef,
  ClickUpTaskRef
} from '@/types/project'
import type { ElevenLabsVoiceTemplate } from '@/types/ai33'

interface RecentProject {
  name: string
  path: string
  lastOpened: number
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

interface RawAudioBlock {
  id: string
  material_id: string
  start_ms: number
  end_ms: number
  duration_ms: number
  file_path: string
  tone_type: string
  tone_platform: string
  track_index: number
}

export interface DirectorStateSnapshot {
  version: number
  rawScript?: string
  scenes?: Scene[]
  storyBlocks?: StoryBlock[]
  directorConfig?: Partial<DirectorConfig>
  characterRefs?: CharacterRef[]
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
  directorConfig: DirectorConfig
  directorProgress: DirectorProgress
  characterRefs: CharacterRef[]
  clickUpTaskRef: ClickUpTaskRef | null
  elevenLabsVoiceTemplates: ElevenLabsVoiceTemplate[]

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
  reloadAudioBlocks: (draftPath: string) => Promise<void>
  fetchCapCutProjects: () => Promise<void>
  resetProject: () => void
  setDirectorConfig: (updates: Partial<DirectorConfig>) => void
  updateScene: (id: string, updates: Partial<Scene>) => void
  removeScene: (id: string) => void
  insertScene: (afterIndex: number, scene: Scene) => void
  reorderScenes: (sceneIds: string[]) => void
  bulkUpdateScenes: (updates: Array<{ id: string; updates: Partial<Scene> }>) => void
  setDirectorProgress: (progress: Partial<DirectorProgress>) => void
  setCharacterRefs: (refs: CharacterRef[]) => void
  setClickUpTaskRef: (ref: ClickUpTaskRef | null) => void
  loadDirectorState: (snapshot: DirectorStateSnapshot) => void
  addElevenLabsVoiceTemplate: (template: ElevenLabsVoiceTemplate) => void
  removeElevenLabsVoiceTemplate: (id: string) => void
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
  capCutProjectsLoading: false,
  directorConfig: {
    sequenceMode: 'video-only',
    videoMinDurationMs: 6000,
    videoMaxDurationMs: 8000,
    imageMinDurationMs: 3000,
    imageMaxDurationMs: 5000,
    llmProvider: 'claude',
    llmModel: 'claude-opus-4-6',
    promptTemplate: '',
    promptExamples: '',
    variationSeed: Math.floor(Math.random() * 100000)
  } as DirectorConfig,
  directorProgress: {
    isPlanning: false,
    isGeneratingPrompts: false,
    currentSceneIndex: 0,
    totalScenes: 0,
    error: null,
    currentBatch: 0,
    totalBatches: 0,
    batchStartTake: 0,
    batchEndTake: 0,
    completedTakes: 0,
    batchResults: [],
    startedAt: null
  } as DirectorProgress,
  characterRefs: [] as CharacterRef[],
  clickUpTaskRef: null as ClickUpTaskRef | null,
  elevenLabsVoiceTemplates: [
    {
      id: 'preset-lena',
      name: 'Lena',
      voiceId: 'KoVIHoyLDrQyd4pGalbs',
      voiceName: 'Autumn Veil - Warm and Reflective',
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      },
      createdAt: 1740000000000
    },
    {
      id: 'preset-lena-2',
      name: 'LENA 2',
      voiceId: 'KoVIHoyLDrQyd4pGalbs',
      voiceName: 'Autumn Veil - Warm and Reflective',
      modelId: 'eleven_multilingual_v2',
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.7,
        style: 0.0,
        use_speaker_boost: true
      },
      createdAt: 1740000000001
    }
  ] as ElevenLabsVoiceTemplate[]
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
          const prevState = useProjectStore.getState()
          const prevStoryBlocks = prevState.storyBlocks
          const prevAudioBlocks = prevState.audioBlocks

          const raw = (await window.api.loadFullProject(draftPath)) as RawFullProjectResponse

          console.log('[loadFullProject] Raw from disk:', {
            text_segments: raw.text_segments.length,
            audio_segments: raw.audio_segments.length,
            video_segments: raw.video_segments.length
          })
          console.log('[loadFullProject] Previous in-memory:', {
            storyBlocks: prevStoryBlocks.length,
            audioBlocks: prevAudioBlocks.length,
            hadLinkedAudio: prevAudioBlocks.some((a) => a.linkedBlockId !== null),
            hadLinkedStory: prevStoryBlocks.some((s) => s.linkedAudioId !== null)
          })

          if (prevStoryBlocks.length > 0 && raw.text_segments.length > 0) {
            const prevFirst = prevStoryBlocks[0]
            const rawFirst = raw.text_segments[0]
            console.log('[loadFullProject] Timing comparison StoryBlock[0]:', {
              prev: { start: prevFirst.startMs, end: prevFirst.endMs, text: prevFirst.text.slice(0, 30) },
              disk: { start: rawFirst.start_ms, end: rawFirst.end_ms, text: rawFirst.text.slice(0, 30) }
            })
          }

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
          const norm = (p: string): string => p.replace(/\\/g, '/')
          const filtered = state.recentProjects.filter(
            (p) => norm(p.path) !== norm(project.path)
          )
          return { recentProjects: [project, ...filtered].slice(0, 10) }
        })
      },
      removeRecentProject: (path) => {
        set((state) => ({
          recentProjects: state.recentProjects.filter((p) => p.path !== path)
        }))
      },
      reloadAudioBlocks: async (draftPath) => {
        const raw = (await window.api.readAudioBlocks(draftPath)) as RawAudioBlock[]
        const audioBlocks: AudioBlock[] = raw.map((seg, i) => ({
          id: seg.id || crypto.randomUUID(),
          index: i + 1,
          filePath: seg.file_path,
          startMs: seg.start_ms,
          endMs: seg.end_ms,
          durationMs: seg.duration_ms,
          linkedBlockId: null,
          source: 'capcut' as const
        }))
        set({ audioBlocks })
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
      setDirectorConfig: (updates) => {
        set((state) => ({
          directorConfig: { ...state.directorConfig, ...updates }
        }))
      },
      updateScene: (id, updates) => {
        set((state) => ({
          scenes: state.scenes.map((s) => (s.id === id ? { ...s, ...updates } : s))
        }))
      },
      removeScene: (id) => {
        set((state) => ({
          scenes: state.scenes
            .filter((s) => s.id !== id)
            .map((s, i) => ({ ...s, index: i + 1 }))
        }))
      },
      insertScene: (afterIndex, scene) => {
        set((state) => {
          const newScenes = [...state.scenes]
          newScenes.splice(afterIndex, 0, scene)
          return { scenes: newScenes.map((s, i) => ({ ...s, index: i + 1 })) }
        })
      },
      reorderScenes: (sceneIds) => {
        set((state) => {
          const ordered = sceneIds
            .map((id) => state.scenes.find((s) => s.id === id))
            .filter(Boolean) as Scene[]
          return { scenes: ordered.map((s, i) => ({ ...s, index: i + 1 })) }
        })
      },
      bulkUpdateScenes: (updates) => {
        set((state) => {
          const map = new Map(updates.map((u) => [u.id, u.updates]))
          return {
            scenes: state.scenes.map((s) => {
              const u = map.get(s.id)
              return u ? { ...s, ...u } : s
            })
          }
        })
      },
      setDirectorProgress: (progress) => {
        set((state) => ({
          directorProgress: { ...state.directorProgress, ...progress }
        }))
      },
      setCharacterRefs: (refs) => {
        set({ characterRefs: refs })
      },
      setClickUpTaskRef: (ref) => {
        set({ clickUpTaskRef: ref })
      },
      loadDirectorState: (snapshot) => {
        // Migrate scenes: ensure chapter is always a number (old snapshots may lack it)
        const migratedScenes = snapshot.scenes?.map((s) => ({
          ...s,
          chapter: typeof s.chapter === 'number' ? s.chapter : 1
        }))

        set((state) => ({
          rawScript: snapshot.rawScript ?? state.rawScript,
          scenes: migratedScenes ?? state.scenes,
          storyBlocks: snapshot.storyBlocks ?? state.storyBlocks,
          directorConfig: snapshot.directorConfig
            ? { ...state.directorConfig, ...snapshot.directorConfig }
            : state.directorConfig,
          // Preserve current characterRefs if snapshot has empty array
          characterRefs:
            snapshot.characterRefs && snapshot.characterRefs.length > 0
              ? snapshot.characterRefs
              : state.characterRefs
        }))
        if (snapshot.scenes && snapshot.scenes.length > 0) {
          useStageStore.getState().setFreeNavigation(true)
        }
      },
      addElevenLabsVoiceTemplate: (template) => {
        set((state) => ({
          elevenLabsVoiceTemplates: [...state.elevenLabsVoiceTemplates, template]
        }))
      },
      removeElevenLabsVoiceTemplate: (id) => {
        set((state) => ({
          elevenLabsVoiceTemplates: state.elevenLabsVoiceTemplates.filter((t) => t.id !== id)
        }))
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mediaPreset: state.mediaPreset,
        ttsDefaults: state.ttsDefaults,
        recentProjects: state.recentProjects,
        directorConfig: state.directorConfig,
        characterRefs: state.characterRefs,
        elevenLabsVoiceTemplates: state.elevenLabsVoiceTemplates
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version === 0) {
          const dc = state.directorConfig as Record<string, unknown> | undefined
          if (dc) {
            dc.llmProvider = 'claude'
            if (!dc.llmModel) dc.llmModel = 'claude-opus-4-6'
          }
        }
        if (version < 2) {
          const templates = (state.elevenLabsVoiceTemplates ?? []) as ElevenLabsVoiceTemplate[]
          if (!templates.some((t) => t.id === 'preset-lena-2')) {
            state.elevenLabsVoiceTemplates = [
              ...templates,
              {
                id: 'preset-lena-2',
                name: 'LENA 2',
                voiceId: 'KoVIHoyLDrQyd4pGalbs',
                voiceName: 'Autumn Veil - Warm and Reflective',
                modelId: 'eleven_multilingual_v2',
                voiceSettings: {
                  stability: 0.5,
                  similarity_boost: 0.7,
                  style: 0.0,
                  use_speaker_boost: true
                },
                createdAt: 1740000000001
              }
            ]
          }
        }
        return state as unknown as ProjectState
      }
    }
  )
)
