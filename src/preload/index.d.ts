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
  generateSrt: (params: Record<string, unknown>) => Promise<unknown>

  validateProject: (projectPath: string) => Promise<unknown>
  diagnoseRootMeta: (projectName: string) => Promise<unknown>
  checkCapCutRunning: () => Promise<unknown>
  getProjectHealth: (projectPath: string) => Promise<unknown>

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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ElectronAppAPI
  }
}
