export interface IpcChannels {
  'project:select-draft': () => Promise<string | null>
  'project:save': (data: string) => Promise<void>
  'project:load': (path: string) => Promise<string>
  'capcut:read-draft': (draftPath: string) => Promise<unknown>
  'capcut:write-text-segments': (draftPath: string, blocks: unknown[]) => Promise<void>
  'capcut:read-audio-blocks': (draftPath: string) => Promise<unknown[]>
  'capcut:update-subtitle-timings': (draftPath: string, blocks: unknown[]) => Promise<void>
  'capcut:sync-metadata': (draftPath: string) => Promise<void>
  'audio:select-files': () => Promise<string[]>
  'file:select-directory': () => Promise<string | null>
  'file:select-files': (filters: FileFilter[]) => Promise<string[]>
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface ProgressEvent {
  stage: string
  current: number
  total: number
  message: string
}
