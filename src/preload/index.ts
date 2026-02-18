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

  readCapCutDraft: (draftPath: string): Promise<unknown> =>
    ipcRenderer.invoke('capcut:read-draft', draftPath),
  writeTextSegments: (draftPath: string, blocks: unknown[]): Promise<void> =>
    ipcRenderer.invoke('capcut:write-text-segments', draftPath, blocks),
  readAudioBlocks: (draftPath: string): Promise<unknown[]> =>
    ipcRenderer.invoke('capcut:read-audio-blocks', draftPath),
  updateSubtitleTimings: (draftPath: string, blocks: unknown[]): Promise<void> =>
    ipcRenderer.invoke('capcut:update-subtitle-timings', draftPath, blocks),
  syncMetadata: (draftPath: string): Promise<void> =>
    ipcRenderer.invoke('capcut:sync-metadata', draftPath),
  writeVideoSegments: (draftPath: string, scenes: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke('capcut:write-video-segments', draftPath, scenes),

  selectFiles: (filters: FileFilter[]): Promise<string[]> =>
    ipcRenderer.invoke('file:select-files', filters),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('file:select-directory'),

  onProgress: (callback: (event: unknown) => void): (() => void) => {
    const handler = (_event: unknown, data: unknown): void => callback(data)
    ipcRenderer.on('progress', handler)
    return () => ipcRenderer.removeListener('progress', handler)
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
