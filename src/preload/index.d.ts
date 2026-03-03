import { ElectronAPI } from '@electron-toolkit/preload'

interface FileFilter {
  name: string
  extensions: string[]
}

interface ElectronAppAPI {
  selectCapCutDraft: () => Promise<string | null>
  saveProject: (data: string) => Promise<void>
  loadProject: (path: string) => Promise<string>
  createCapCutProject: (name: string) => Promise<unknown>
  listCapCutProjects: () => Promise<unknown[]>
  deleteCapCutProjects: (projectPaths: string[]) => Promise<{
    totalRequested: number
    totalDeleted: number
    results: Array<{ path: string; success: boolean; error?: string }>
  }>

  readCapCutDraft: (draftPath: string) => Promise<unknown>
  loadFullProject: (draftPath: string) => Promise<unknown>
  writeTextSegments: (draftPath: string, blocks: unknown[]) => Promise<unknown>
  readAudioBlocks: (draftPath: string) => Promise<unknown[]>
  readSubtitles: (draftPath: string) => Promise<unknown[]>
  updateSubtitleTimings: (draftPath: string, blocks: unknown[]) => Promise<unknown>
  updateSubtitleTexts: (draftPath: string, updates: unknown[]) => Promise<unknown>
  syncMetadata: (draftPath: string) => Promise<unknown>
  writeVideoSegments: (draftPath: string, scenes: unknown[]) => Promise<unknown>

  syncProject: (params: Record<string, unknown>) => Promise<unknown>
  applyAnimations: (draftPath: string) => Promise<unknown>
  analyzeProject: (draftPath: string) => Promise<unknown>
  insertMediaBatch: (params: Record<string, unknown>) => Promise<unknown>
  createBackup: (draftPath: string) => Promise<unknown>

  insertAudioBatch: (params: Record<string, unknown>) => Promise<unknown>
  insertSrt: (params: Record<string, unknown>) => Promise<unknown>
  insertSrtBatch: (params: Record<string, unknown>) => Promise<unknown>
  flattenAudio: (draftPath: string) => Promise<unknown>
  loopVideo: (params: Record<string, unknown>) => Promise<unknown>
  loopAudio: (params: Record<string, unknown>) => Promise<unknown>

  saveDirectorState: (draftPath: string, data: string) => Promise<{ saved: boolean; error?: string }>
  loadDirectorState: (draftPath: string) => Promise<string | null>

  openCapCut: () => Promise<{ success: boolean; error?: string }>

  selectFiles: (filters: FileFilter[]) => Promise<string[]>
  selectDirectory: () => Promise<string | null>

  loadWorkspaceRegistry: () => Promise<unknown[]>
  createWorkspace: (params: Record<string, unknown>) => Promise<unknown>
  openWorkspace: (id: string) => Promise<unknown>
  updateWorkspace: (params: Record<string, unknown>) => Promise<unknown>
  deleteWorkspace: (params: Record<string, unknown>) => Promise<unknown>
  setDefaultWorkspace: (id: string) => Promise<unknown>
  pinWorkspace: (params: Record<string, unknown>) => Promise<unknown>
  listWorkspaceProjects: (params: { workspaceId: string }) => Promise<unknown[]>
  linkProjectsToWorkspace: (params: {
    workspaceId: string
    projects: Array<{ name: string; capCutPath: string }>
  }) => Promise<unknown>
  unlinkProjectsFromWorkspace: (params: {
    workspaceId: string
    capCutPaths: string[]
  }) => Promise<unknown>
  listAvailableProjects: (params: { workspaceId: string }) => Promise<unknown[]>
  savePipelineStatus: (params: Record<string, unknown>) => Promise<unknown>
  loadPipelineStatus: (params: Record<string, unknown>) => Promise<unknown>
  openInExplorer: (path: string) => Promise<unknown>
  saveWorkspaceRecentProjects: (params: Record<string, unknown>) => Promise<unknown>

  clearTextSegments: (draftPath: string) => Promise<unknown>
  clearVideoSegments: (draftPath: string) => Promise<unknown>
  clearAudioSegments: (draftPath: string) => Promise<unknown>
  generateSrt: (params: Record<string, unknown>) => Promise<unknown>

  validateProject: (projectPath: string) => Promise<unknown>
  diagnoseRootMeta: (projectName: string) => Promise<unknown>
  checkCapCutRunning: () => Promise<unknown>
  closeCapCut: () => Promise<unknown>
  getProjectHealth: (projectPath: string) => Promise<unknown>
  debugSyncState: (params: Record<string, unknown>) => Promise<unknown>

  watchDraft: (draftPath: string) => Promise<unknown>
  unwatchDraft: () => Promise<unknown>

  onProgress: (callback: (event: unknown) => void) => () => void
  onProjectChanged: (callback: (event: unknown) => void) => () => void

  // TTS generation
  ttsGenerate: (params: {
    text?: string
    chunks?: string[]
    voice?: string
    style?: string
    customStylePrompt?: string
    ttsModel?: string
    outputDir?: string
    generateSrt?: boolean
    maxWorkers?: number
  }) => Promise<unknown>
  ttsPreviewVoice: (params: {
    voice: string
    style?: string
    sampleText?: string
    ttsModel?: string
  }) => Promise<unknown>
  ttsListVoices: () => Promise<unknown>
  ttsListStyles: () => Promise<unknown>

  // TTS API key
  ttsSaveApiKey: (apiKey: string) => Promise<unknown>
  ttsHasApiKey: () => Promise<boolean>
  ttsDeleteApiKey: () => Promise<unknown>

  // TTS progress
  onTtsProgress: (callback: (data: unknown) => void) => () => void

  // Director
  directorCheckLlm: (provider: string) => Promise<unknown>
  directorInstallCli: (provider: string) => Promise<unknown>
  directorAnalyzeNarrative: (params: Record<string, unknown>) => Promise<unknown>
  directorGeneratePrompts: (params: Record<string, unknown>) => Promise<unknown>
  directorDecideMediaTypes: (params: Record<string, unknown>) => Promise<unknown>
  directorExportPrompts: (params: Record<string, unknown>) => Promise<unknown>
  directorMatchMediaFiles: (params: Record<string, unknown>) => Promise<unknown>
  directorSelectMediaFiles: () => Promise<string[]>
  directorSelectMediaFolder: () => Promise<{
    directory: string | null
    files: string[]
    total: number
    skipped: number
  }>
  directorImportCharacters: () => Promise<{ files: string[]; directory?: string; error?: string }>

  // VEO3
  veo3ReadScript: (relativePath: string) => Promise<string | null>
  veo3SetDownloadPath: (folderPath: string) => Promise<unknown>
  veo3GetDownloadPath: () => Promise<string>
  veo3ReadImageAsDataUrl: (filePath: string) => Promise<string | null>
  veo3ClearPartition: (partition: string) => Promise<{ success: boolean; error?: string }>
  veo3SyncPromptQueue: (
    items: Array<{ prompt: string; sceneIndex: number }>
  ) => Promise<{ success: boolean; count: number }>
  onVeo3DownloadComplete: (callback: (data: unknown) => void) => () => void

  // AI33.pro
  ai33SaveApiKey: (apiKey: string) => Promise<unknown>
  ai33HasApiKey: () => Promise<boolean>
  ai33DeleteApiKey: () => Promise<unknown>

  ai33GetCredits: () => Promise<unknown>
  ai33HealthCheck: () => Promise<unknown>

  ai33GetTask: (taskId: string) => Promise<unknown>
  ai33ListTasks: (params: { page?: number; limit?: number; type?: string }) => Promise<unknown>
  ai33DeleteTasks: (taskIds: string[]) => Promise<unknown>
  ai33PollTask: (taskId: string) => Promise<unknown>
  ai33DownloadFile: (params: { url: string; destDir?: string; fileName?: string }) => Promise<unknown>

  ai33TtsElevenlabs: (params: {
    voiceId: string
    text: string
    model_id?: string
    with_transcript?: boolean
    output_format?: string
    voice_settings?: Record<string, unknown>
  }) => Promise<unknown>

  ai33TtsMinimax: (params: {
    text: string
    model?: string
    voice_setting: { voice_id: string; vol?: number; pitch?: number; speed?: number }
    language_boost?: string
    with_transcript?: boolean
  }) => Promise<unknown>

  ai33GetModels: () => Promise<unknown>
  ai33GetVoices: () => Promise<unknown>
  ai33GetSharedVoices: (params?: { pageSize?: number; page?: number }) => Promise<unknown>

  ai33MinimaxVoiceList: (params?: { page?: number; page_size?: number; tag_list?: string[] }) => Promise<unknown>
  ai33MinimaxClonedVoices: () => Promise<unknown>
  ai33MinimaxVoiceClone: (params: {
    filePath: string
    voice_name: string
    preview_text?: string
    language_tag?: string
    need_noise_reduction?: boolean
    gender_tag?: string
  }) => Promise<unknown>
  ai33MinimaxDeleteClone: (voiceId: string) => Promise<unknown>
  ai33MinimaxConfig: () => Promise<unknown>

  ai33Dubbing: (params: {
    filePath: string
    num_speakers?: number
    disable_voice_cloning?: boolean
    source_lang?: string
    target_lang?: string
  }) => Promise<unknown>
  ai33SpeechToText: (filePath: string) => Promise<unknown>
  ai33SoundEffect: (params: {
    text: string
    duration_seconds?: number
    prompt_influence?: number
    loop?: boolean
    model_id?: string
  }) => Promise<unknown>
  ai33VoiceChanger: (params: {
    filePath: string
    voice_id: string
    model_id?: string
    voice_settings?: Record<string, unknown>
    remove_background_noise?: boolean
  }) => Promise<unknown>
  ai33VoiceIsolate: (filePath: string) => Promise<unknown>

  ai33MusicGeneration: (params: {
    title?: string
    idea?: string
    lyrics?: string
    style_id?: string
    mood_id?: string
    scenario_id?: string
    n?: number
    rewrite_idea_switch?: boolean
  }) => Promise<unknown>

  ai33ImageModels: () => Promise<unknown>
  ai33ImagePrice: (params: {
    model_id: string
    generations_count: number
    model_parameters?: Record<string, unknown>
  }) => Promise<unknown>
  ai33GenerateImage: (params: {
    prompt: string
    model_id: string
    generations_count?: number
    model_parameters?: Record<string, unknown>
    assetPaths?: string[]
  }) => Promise<unknown>

  onAi33TaskProgress: (callback: (data: unknown) => void) => () => void

  // ClickUp
  clickupSaveApiKey: (apiKey: string) => Promise<unknown>
  clickupHasApiKey: () => Promise<boolean>
  clickupDeleteApiKey: () => Promise<unknown>
  clickupGetTeams: () => Promise<unknown>
  clickupGetSpaces: (teamId: string) => Promise<unknown>
  clickupGetFolders: (spaceId: string) => Promise<unknown>
  clickupGetFolderlessLists: (spaceId: string) => Promise<unknown>
  clickupGetLists: (folderId: string) => Promise<unknown>
  clickupGetTasks: (params: { listId: string; page?: number }) => Promise<unknown>
  clickupGetTask: (taskId: string) => Promise<unknown>
  clickupGetList: (listId: string) => Promise<unknown>
  clickupDownloadAttachment: (params: {
    url: string
    destDir?: string
    fileName?: string
  }) => Promise<unknown>
  clickupDownloadTaskAttachments: (params: {
    attachments: Array<{ url: string; fileName: string }>
    destDir?: string
  }) => Promise<unknown>
  clickupReadTextFile: (filePath: string) => Promise<unknown>
  clickupTestConnection: () => Promise<unknown>
  clickupSaveDefaultList: (
    config: { listId: string; listName: string; breadcrumb: string } | null
  ) => Promise<unknown>
  clickupGetDefaultList: () => Promise<unknown>

  // CDP (Chrome DevTools Protocol) automation
  cdpAttach: (webContentsId: number) => Promise<{ success: boolean; error?: string }>
  cdpDetach: () => Promise<{ success: boolean }>
  cdpClickElement: (selector: string) => Promise<{ success: boolean; error?: string }>
  cdpType: (text: string) => Promise<{ success: boolean; error?: string }>
  cdpPress: (key: string) => Promise<{ success: boolean; error?: string }>
  cdpEvaluate: (expression: string) => Promise<{ success: boolean; result?: unknown; error?: string }>
  cdpGetRect: (selector: string) => Promise<{ success: boolean; rect?: unknown; error?: string }>
  cdpPocTest: () => Promise<{ success: boolean; results?: unknown[]; error?: string }>
  cdpFillPrompt: (text: string) => Promise<{ success: boolean; error?: string }>
  cdpClickSubmit: () => Promise<{ success: boolean; error?: string }>
  cdpClickAt: (x: number, y: number, button?: string) => Promise<{ success: boolean; error?: string }>

  // System
  systemHealthCheck: () => Promise<{
    python: { ok: boolean; error?: string }
    capcut: { ok: boolean; path?: string }
    capcutProjects: { ok: boolean; path?: string }
  }>
  systemClearCache: () => Promise<{ success: boolean }>

  // Updater
  updaterCheck: () => Promise<{ success: boolean; version?: string | null; error?: string }>
  updaterDownload: () => Promise<{ success: boolean; error?: string }>
  updaterInstall: () => Promise<{ success: boolean }>
  updaterGetVersion: () => Promise<string>
  onUpdaterStatus: (callback: (data: unknown) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ElectronAppAPI
  }
}
