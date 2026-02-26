import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface FileFilter {
  name: string
  extensions: string[]
}

const api = {
  selectCapCutDraft: (): Promise<string | null> => ipcRenderer.invoke('project:select-draft'),
  saveProject: (data: string): Promise<void> => ipcRenderer.invoke('project:save', data),
  loadProject: (path: string): Promise<string> => ipcRenderer.invoke('project:load', path),
  createCapCutProject: (name: string): Promise<unknown> =>
    ipcRenderer.invoke('project:create-capcut', name),
  listCapCutProjects: (): Promise<unknown[]> => ipcRenderer.invoke('project:list-capcut'),
  deleteCapCutProjects: (projectPaths: string[]): Promise<unknown> =>
    ipcRenderer.invoke('project:delete-capcut', { projectPaths }),

  readCapCutDraft: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:read-draft', draftPath),
  loadFullProject: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:load-full-project', draftPath),
  writeTextSegments: (draftPath: string, blocks: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('capcut:write-text-segments', draftPath, blocks),
  readAudioBlocks: (draftPath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('capcut:read-audio-blocks', draftPath),
  readSubtitles: (draftPath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('capcut:read-subtitles', draftPath),
  updateSubtitleTexts: (draftPath: string, updates: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('capcut:update-subtitle-texts', draftPath, updates),
  updateSubtitleTimings: (draftPath: string, blocks: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('capcut:update-subtitle-timings', draftPath, blocks),
  syncMetadata: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:sync-metadata', draftPath),
  writeVideoSegments: (draftPath: string, scenes: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('capcut:write-video-segments', draftPath, scenes),

  syncProject: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:sync-project', params),
  applyAnimations: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:apply-animations', draftPath),
  analyzeProject: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:analyze-project', draftPath),
  insertMediaBatch: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:insert-media-batch', params),
  createBackup: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:create-backup', draftPath),

  insertAudioBatch: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:insert-audio-batch', params),
  insertSrt: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:insert-srt', params),
  insertSrtBatch: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:insert-srt-batch', params),
  flattenAudio: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:flatten-audio', draftPath),
  loopVideo: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:loop-video', params),
  loopAudio: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:loop-audio', params),

  saveDirectorState: (draftPath: string, data: string): Promise<{ saved: boolean; error?: string }> =>
    ipcRenderer.invoke('project:save-director', draftPath, data),
  loadDirectorState: (draftPath: string): Promise<string | null> =>
    ipcRenderer.invoke('project:load-director', draftPath),

  openCapCut: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('project:open-capcut'),

  selectFiles: (filters: FileFilter[]): Promise<string[]> =>
    ipcRenderer.invoke('file:select-files', filters),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('file:select-directory'),

  loadWorkspaceRegistry: (): Promise<unknown[]> => ipcRenderer.invoke('workspace:load-registry'),
  createWorkspace: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:create', params),
  openWorkspace: (id: string): Promise<unknown> => ipcRenderer.invoke('workspace:open', id),
  updateWorkspace: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:update', params),
  deleteWorkspace: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:delete', params),
  setDefaultWorkspace: (id: string): Promise<unknown> =>
    ipcRenderer.invoke('workspace:set-default', id),
  pinWorkspace: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:pin', params),
  listWorkspaceProjects: (params: { workspaceId: string }): Promise<unknown[]> =>
    ipcRenderer.invoke('workspace:list-projects', params),
  linkProjectsToWorkspace: (params: {
    workspaceId: string
    projects: Array<{ name: string; capCutPath: string }>
  }): Promise<unknown> => ipcRenderer.invoke('workspace:link-projects', params),
  unlinkProjectsFromWorkspace: (params: {
    workspaceId: string
    capCutPaths: string[]
  }): Promise<unknown> => ipcRenderer.invoke('workspace:unlink-projects', params),
  listAvailableProjects: (params: { workspaceId: string }): Promise<unknown[]> =>
    ipcRenderer.invoke('workspace:list-available-projects', params),
  savePipelineStatus: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:save-pipeline-status', params),
  loadPipelineStatus: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:load-pipeline-status', params),
  openInExplorer: (path: string): Promise<unknown> =>
    ipcRenderer.invoke('workspace:open-in-explorer', path),
  saveWorkspaceRecentProjects: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('workspace:save-recent-projects', params),

  clearTextSegments: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:clear-text-segments', draftPath),
  clearVideoSegments: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:clear-video-segments', draftPath),
  generateSrt: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:generate-srt', params),

  validateProject: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:validate-project', projectPath),
  diagnoseRootMeta: (projectName: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:diagnose-root-meta', projectName),
  checkCapCutRunning: (): Promise<unknown> => ipcRenderer.invoke('capcut:check-capcut-running'),
  closeCapCut: (): Promise<unknown> => ipcRenderer.invoke('capcut:close-capcut'),
  getProjectHealth: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:get-project-health', projectPath),
  debugSyncState: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('capcut:debug-sync-state', params),

  watchDraft: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:watch-draft', draftPath),
  unwatchDraft: (): Promise<unknown> => ipcRenderer.invoke('project:unwatch-draft'),

  onProgress: (callback: (event: unknown) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(data)
    ipcRenderer.on('progress', handler)
    return () => ipcRenderer.removeListener('progress', handler)
  },

  onProjectChanged: (callback: (event: unknown) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(data)
    ipcRenderer.on('capcut:project-changed', handler)
    return () => ipcRenderer.removeListener('capcut:project-changed', handler)
  },

  // TTS generation
  ttsGenerate: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('tts:generate', params),
  ttsPreviewVoice: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('tts:preview-voice', params),
  ttsListVoices: (): Promise<unknown> => ipcRenderer.invoke('tts:list-voices'),
  ttsListStyles: (): Promise<unknown> => ipcRenderer.invoke('tts:list-styles'),

  // TTS API key
  ttsSaveApiKey: (apiKey: string): Promise<unknown> =>
    ipcRenderer.invoke('tts:save-api-key', apiKey),
  ttsHasApiKey: (): Promise<boolean> => ipcRenderer.invoke('tts:has-api-key'),
  ttsDeleteApiKey: (): Promise<unknown> => ipcRenderer.invoke('tts:delete-api-key'),

  // TTS progress listener
  onTtsProgress: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(data)
    ipcRenderer.on('tts:progress', handler)
    return () => ipcRenderer.removeListener('tts:progress', handler)
  },

  // Director
  directorCheckLlm: (provider: string): Promise<unknown> =>
    ipcRenderer.invoke('director:check-llm-available', provider),
  directorInstallCli: (provider: string): Promise<unknown> =>
    ipcRenderer.invoke('director:install-cli', provider),
  directorAnalyzeNarrative: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('director:analyze-narrative', params),
  directorGeneratePrompts: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('director:generate-prompts', params),
  directorDecideMediaTypes: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('director:decide-media-types', params),
  directorExportPrompts: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('director:export-prompts', params),
  directorMatchMediaFiles: (params: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('director:match-media-files', params),
  directorSelectMediaFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('director:select-media-files'),
  directorSelectMediaFolder: (): Promise<{
    directory: string | null
    files: string[]
    total: number
    skipped: number
  }> => ipcRenderer.invoke('director:select-media-folder'),
  directorImportCharacters: (): Promise<{ files: string[]; directory?: string; error?: string }> =>
    ipcRenderer.invoke('director:import-characters'),

  // VEO3
  veo3ReadScript: (relativePath: string): Promise<string | null> =>
    ipcRenderer.invoke('veo3:read-injector-script', relativePath),
  veo3SetDownloadPath: (folderPath: string): Promise<unknown> =>
    ipcRenderer.invoke('veo3:set-download-path', folderPath),
  veo3GetDownloadPath: (): Promise<string> =>
    ipcRenderer.invoke('veo3:get-download-path'),
  veo3ReadImageAsDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('veo3:read-image-as-dataurl', filePath),
  veo3ClearPartition: (partition: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('veo3:clear-partition', partition),
  onVeo3DownloadComplete: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(data)
    ipcRenderer.on('veo3:download-complete', handler)
    return () => ipcRenderer.removeListener('veo3:download-complete', handler)
  },

  // AI33.pro
  ai33SaveApiKey: (apiKey: string): Promise<unknown> =>
    ipcRenderer.invoke('ai33:save-api-key', apiKey),
  ai33HasApiKey: (): Promise<boolean> => ipcRenderer.invoke('ai33:has-api-key'),
  ai33DeleteApiKey: (): Promise<unknown> => ipcRenderer.invoke('ai33:delete-api-key'),

  ai33GetCredits: (): Promise<unknown> => ipcRenderer.invoke('ai33:get-credits'),
  ai33HealthCheck: (): Promise<unknown> => ipcRenderer.invoke('ai33:health-check'),

  ai33GetTask: (taskId: string): Promise<unknown> =>
    ipcRenderer.invoke('ai33:get-task', taskId),
  ai33ListTasks: (params: { page?: number; limit?: number; type?: string }): Promise<unknown> =>
    ipcRenderer.invoke('ai33:list-tasks', params),
  ai33DeleteTasks: (taskIds: string[]): Promise<unknown> =>
    ipcRenderer.invoke('ai33:delete-tasks', taskIds),
  ai33PollTask: (taskId: string): Promise<unknown> =>
    ipcRenderer.invoke('ai33:poll-task', taskId),
  ai33DownloadFile: (params: { url: string; destDir?: string; fileName?: string }): Promise<unknown> =>
    ipcRenderer.invoke('ai33:download-file', params),

  ai33TtsElevenlabs: (params: {
    voiceId: string
    text: string
    model_id?: string
    with_transcript?: boolean
    output_format?: string
  }): Promise<unknown> => ipcRenderer.invoke('ai33:tts-elevenlabs', params),

  ai33TtsMinimax: (params: {
    text: string
    model?: string
    voice_setting: { voice_id: string; vol?: number; pitch?: number; speed?: number }
    language_boost?: string
    with_transcript?: boolean
  }): Promise<unknown> => ipcRenderer.invoke('ai33:tts-minimax', params),

  ai33GetModels: (): Promise<unknown> => ipcRenderer.invoke('ai33:get-models'),
  ai33GetVoices: (): Promise<unknown> => ipcRenderer.invoke('ai33:get-voices'),
  ai33GetSharedVoices: (params?: { pageSize?: number; page?: number }): Promise<unknown> =>
    ipcRenderer.invoke('ai33:get-shared-voices', params),

  ai33MinimaxVoiceList: (params?: { page?: number; page_size?: number; tag_list?: string[] }): Promise<unknown> =>
    ipcRenderer.invoke('ai33:minimax-voice-list', params),
  ai33MinimaxClonedVoices: (): Promise<unknown> =>
    ipcRenderer.invoke('ai33:minimax-cloned-voices'),
  ai33MinimaxVoiceClone: (params: {
    filePath: string
    voice_name: string
    preview_text?: string
    language_tag?: string
    need_noise_reduction?: boolean
    gender_tag?: string
  }): Promise<unknown> => ipcRenderer.invoke('ai33:minimax-voice-clone', params),
  ai33MinimaxDeleteClone: (voiceId: string): Promise<unknown> =>
    ipcRenderer.invoke('ai33:minimax-delete-clone', voiceId),
  ai33MinimaxConfig: (): Promise<unknown> => ipcRenderer.invoke('ai33:minimax-config'),

  ai33Dubbing: (params: {
    filePath: string
    num_speakers?: number
    disable_voice_cloning?: boolean
    source_lang?: string
    target_lang?: string
  }): Promise<unknown> => ipcRenderer.invoke('ai33:dubbing', params),
  ai33SpeechToText: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('ai33:speech-to-text', filePath),
  ai33SoundEffect: (params: {
    text: string
    duration_seconds?: number
    prompt_influence?: number
    loop?: boolean
    model_id?: string
  }): Promise<unknown> => ipcRenderer.invoke('ai33:sound-effect', params),
  ai33VoiceChanger: (params: {
    filePath: string
    voice_id: string
    model_id?: string
    voice_settings?: Record<string, unknown>
    remove_background_noise?: boolean
  }): Promise<unknown> => ipcRenderer.invoke('ai33:voice-changer', params),
  ai33VoiceIsolate: (filePath: string): Promise<unknown> =>
    ipcRenderer.invoke('ai33:voice-isolate', filePath),

  ai33MusicGeneration: (params: {
    title?: string
    idea?: string
    lyrics?: string
    style_id?: string
    mood_id?: string
    scenario_id?: string
    n?: number
    rewrite_idea_switch?: boolean
  }): Promise<unknown> => ipcRenderer.invoke('ai33:music-generation', params),

  ai33ImageModels: (): Promise<unknown> => ipcRenderer.invoke('ai33:image-models'),
  ai33ImagePrice: (params: {
    model_id: string
    generations_count: number
    model_parameters?: Record<string, unknown>
  }): Promise<unknown> => ipcRenderer.invoke('ai33:image-price', params),
  ai33GenerateImage: (params: {
    prompt: string
    model_id: string
    generations_count?: number
    model_parameters?: Record<string, unknown>
    assetPaths?: string[]
  }): Promise<unknown> => ipcRenderer.invoke('ai33:generate-image', params),

  onAi33TaskProgress: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(data)
    ipcRenderer.on('ai33:task-progress', handler)
    return () => ipcRenderer.removeListener('ai33:task-progress', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
