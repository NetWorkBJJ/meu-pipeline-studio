export type Veo3AutomationStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed'

export interface Veo3ContentMessage {
  type: string
  action?: string
  data?: unknown
  messageId?: string
}

export interface Veo3DownloadItem {
  id: string
  filename: string
  path: string
  folder: string
  completedAt: number
}

export interface Veo3Account {
  id: string
  name: string
  description: string
  partition: string
  color: string
  createdAt: number
  lastUsed: number | null
}

export interface Veo3Tab {
  id: string
  accountId: string
}

export interface TabPanelState {
  sidepanelVisible: boolean
  automationStatus: Veo3AutomationStatus
  currentPromptIndex: number
  totalPrompts: number
  promptsProcessed: number
  elapsedMs: number
}

export interface Veo3PromptItem {
  index: number
  text: string
  status: 'pending' | 'generating' | 'done' | 'failed'
}

// Flow automation types
export type FlowCreationMode = 'texto' | 'elementos' | 'imagem'

export type FlowCommandStatus =
  | 'queued'
  | 'sending'
  | 'submitted'
  | 'generating'
  | 'done'
  | 'failed'
  | 'skipped'

export interface FlowCharacterImageRef {
  characterId: string
  name: string
  keywords: string[]
  imagePath: string | null
  galleryItemName: string | null
  image?: { dataUrl: string; name: string }
}

export interface FlowCommand {
  id: string
  sceneId: string
  sceneIndex: number
  chapter: number
  prompt: string
  mode: FlowCreationMode
  characterImages: FlowCharacterImageRef[]
  status: FlowCommandStatus
  tabId: string | null
  submittedAt: number | null
  completedAt: number | null
  error: string | null
}

export interface BatchPauseInfo {
  batch: number
  totalBatches: number
  totalSeconds: number
  pauseEndsAt: number
  mode: string
}

export interface FlowAutomationState {
  commands: FlowCommand[]
  isRunning: boolean
  isPaused: boolean
  currentCommandIndex: number
  startedAt: number | null
  error: string | null
}

export type WebviewElement = HTMLElement & {
  src: string
  partition: string
  allowpopups: string
  executeJavaScript: (code: string) => Promise<unknown>
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
  stop: () => void
  getURL: () => string
  getTitle: () => string
  setZoomFactor: (factor: number) => void
  getZoomFactor: () => number
  openDevTools: () => void
  getWebContentsId: () => number
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void
  removeEventListener: (event: string, handler: (...args: unknown[]) => void) => void
}
