export interface WorkspaceMetadata {
  id: string
  name: string
  description: string
  path: string
  createdAt: string
  updatedAt: string
  isDefault: boolean
}

export interface WorkspaceRegistryEntry extends WorkspaceMetadata {
  lastOpenedAt: string | null
  pinned: boolean
  projectCount: number
  _missing: boolean
}

export interface ProjectLink {
  name: string
  capCutPath: string
  linkedAt: string
}

export interface WorkspaceConfig {
  id: string
  name: string
  description: string
  capCutProjectsPath: string
  projects: ProjectLink[]
  mediaPreset: {
    defaultType: 'video' | 'photo'
    defaultDurationMs: number
    transitionMs: number
  }
  recentProjects: WorkspaceRecentProject[]
  pipelineStatuses: Record<string, PipelineStatus>
}

export interface WorkspaceRecentProject {
  name: string
  path: string
  lastOpened: number
}

export interface PipelineStatus {
  completedStages: number[]
  lastStage: number
  lastRunAt: string | null
  scriptBlockCount: number
  audioBlockCount: number
  sceneCount: number
}
