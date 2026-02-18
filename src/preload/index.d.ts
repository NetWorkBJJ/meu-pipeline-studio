import { ElectronAPI } from '@electron-toolkit/preload'

interface FileFilter {
  name: string
  extensions: string[]
}

interface ElectronAppAPI {
  selectCapCutDraft: () => Promise<string | null>
  saveProject: (data: string) => Promise<void>
  loadProject: (path: string) => Promise<string>
  readCapCutDraft: (draftPath: string) => Promise<unknown>
  writeTextSegments: (draftPath: string, blocks: unknown[]) => Promise<void>
  readAudioBlocks: (draftPath: string) => Promise<unknown[]>
  updateSubtitleTimings: (draftPath: string, blocks: unknown[]) => Promise<void>
  syncMetadata: (draftPath: string) => Promise<void>
  writeVideoSegments: (draftPath: string, scenes: unknown[]) => Promise<unknown>
  selectFiles: (filters: FileFilter[]) => Promise<string[]>
  selectDirectory: () => Promise<string | null>
  onProgress: (callback: (event: unknown) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ElectronAppAPI
  }
}
