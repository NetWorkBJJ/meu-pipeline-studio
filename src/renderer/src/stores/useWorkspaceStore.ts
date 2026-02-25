import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  WorkspaceRegistryEntry,
  WorkspaceConfig,
  PipelineStatus,
  WorkspaceRecentProject
} from '@/types/workspace'

interface WorkspaceState {
  registry: WorkspaceRegistryEntry[]
  activeWorkspaceId: string | null
  activeWorkspace: WorkspaceConfig | null
  registryLoading: boolean
  workspaceLoading: boolean

  loadRegistry: () => Promise<void>
  createWorkspace: (params: {
    name: string
    description: string
    path: string
    capCutProjectsPath?: string
  }) => Promise<WorkspaceRegistryEntry>
  openWorkspace: (id: string) => Promise<WorkspaceConfig>
  updateWorkspace: (params: {
    id: string
    name?: string
    description?: string
    capCutProjectsPath?: string
  }) => Promise<void>
  deleteWorkspace: (id: string, deleteFiles?: boolean) => Promise<void>
  pinWorkspace: (id: string, pinned: boolean) => Promise<void>
  setDefaultWorkspace: (id: string) => Promise<void>
  closeWorkspace: () => void
  saveRecentProjects: (projects: WorkspaceRecentProject[]) => Promise<void>
  savePipelineStatus: (projectPath: string, status: PipelineStatus) => Promise<void>
  loadPipelineStatus: (projectPath: string) => Promise<PipelineStatus | null>
  linkProjects: (
    projects: Array<{ name: string; capCutPath: string }>
  ) => Promise<{ added: number; projectCount: number }>
  unlinkProjects: (
    capCutPaths: string[]
  ) => Promise<{ removed: number; projectCount: number }>
  getSortedRegistry: () => WorkspaceRegistryEntry[]
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      registry: [],
      activeWorkspaceId: null,
      activeWorkspace: null,
      registryLoading: false,
      workspaceLoading: false,

      loadRegistry: async () => {
        set({ registryLoading: true })
        try {
          const raw = (await window.api.loadWorkspaceRegistry()) as WorkspaceRegistryEntry[]
          set({ registry: raw })
        } catch {
          set({ registry: [] })
        } finally {
          set({ registryLoading: false })
        }
      },

      createWorkspace: async (params) => {
        const result = (await window.api.createWorkspace(params)) as {
          entry: WorkspaceRegistryEntry
          config: WorkspaceConfig
        }
        set((state) => ({
          registry: [...state.registry, result.entry],
          activeWorkspaceId: result.entry.id,
          activeWorkspace: result.config
        }))
        return result.entry
      },

      openWorkspace: async (id) => {
        set({ workspaceLoading: true })
        try {
          const result = (await window.api.openWorkspace(id)) as {
            entry: WorkspaceRegistryEntry
            config: WorkspaceConfig
          }
          set((state) => ({
            activeWorkspaceId: id,
            activeWorkspace: result.config,
            registry: state.registry.map((e) => (e.id === id ? result.entry : e))
          }))
          return result.config
        } finally {
          set({ workspaceLoading: false })
        }
      },

      updateWorkspace: async (params) => {
        const entry = (await window.api.updateWorkspace(params)) as WorkspaceRegistryEntry
        set((state) => ({
          registry: state.registry.map((e) => (e.id === params.id ? { ...e, ...entry } : e)),
          activeWorkspace:
            state.activeWorkspace && state.activeWorkspaceId === params.id
              ? {
                  ...state.activeWorkspace,
                  ...(params.name !== undefined ? { name: params.name } : {}),
                  ...(params.description !== undefined ? { description: params.description } : {}),
                  ...(params.capCutProjectsPath !== undefined
                    ? { capCutProjectsPath: params.capCutProjectsPath }
                    : {})
                }
              : state.activeWorkspace
        }))
      },

      deleteWorkspace: async (id, deleteFiles = false) => {
        await window.api.deleteWorkspace({ id, deleteFiles })
        set((state) => ({
          registry: state.registry.filter((e) => e.id !== id),
          activeWorkspaceId: state.activeWorkspaceId === id ? null : state.activeWorkspaceId,
          activeWorkspace: state.activeWorkspaceId === id ? null : state.activeWorkspace
        }))
      },

      pinWorkspace: async (id, pinned) => {
        const updated = (await window.api.pinWorkspace({ id, pinned })) as WorkspaceRegistryEntry
        set((state) => ({
          registry: state.registry.map((e) => (e.id === id ? updated : e))
        }))
      },

      setDefaultWorkspace: async (id) => {
        await window.api.setDefaultWorkspace(id)
        set((state) => ({
          registry: state.registry.map((e) => ({
            ...e,
            isDefault: e.id === id
          }))
        }))
      },

      closeWorkspace: () => {
        set({ activeWorkspaceId: null, activeWorkspace: null })
      },

      saveRecentProjects: async (projects) => {
        const state = get()
        if (!state.activeWorkspace) return
        const entry = state.registry.find((e) => e.id === state.activeWorkspaceId)
        if (!entry) return

        // Deduplicate by normalized path (keep first occurrence)
        const seen = new Set<string>()
        const deduped = projects.filter((p) => {
          const key = p.path.replace(/\\/g, '/')
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        await window.api.saveWorkspaceRecentProjects({
          workspacePath: entry.path,
          recentProjects: deduped
        })
        set((s) => ({
          activeWorkspace: s.activeWorkspace
            ? { ...s.activeWorkspace, recentProjects: deduped }
            : null
        }))
      },

      savePipelineStatus: async (projectPath, status) => {
        const state = get()
        if (!state.activeWorkspace) return
        const entry = state.registry.find((e) => e.id === state.activeWorkspaceId)
        if (!entry) return

        await window.api.savePipelineStatus({
          workspacePath: entry.path,
          projectPath,
          status
        })
        set((s) => ({
          activeWorkspace: s.activeWorkspace
            ? {
                ...s.activeWorkspace,
                pipelineStatuses: {
                  ...s.activeWorkspace.pipelineStatuses,
                  [projectPath]: status
                }
              }
            : null
        }))
      },

      loadPipelineStatus: async (projectPath) => {
        const state = get()
        if (!state.activeWorkspace) return null
        const entry = state.registry.find((e) => e.id === state.activeWorkspaceId)
        if (!entry) return null

        const status = (await window.api.loadPipelineStatus({
          workspacePath: entry.path,
          projectPath
        })) as PipelineStatus | null

        // Migrate old 6-stage data to 5-stage pipeline
        if (status && status.completedStages.some((s) => s > 5)) {
          const migrated = new Set(status.completedStages.filter((s) => s <= 5))
          if (status.completedStages.includes(6)) {
            migrated.add(5)
          }
          status.completedStages = [...migrated].sort()
          if (status.lastStage > 5) status.lastStage = 5
        }
        return status
      },

      linkProjects: async (projects) => {
        const state = get()
        if (!state.activeWorkspaceId) throw new Error('No active workspace')

        const result = (await window.api.linkProjectsToWorkspace({
          workspaceId: state.activeWorkspaceId,
          projects
        })) as { success: boolean; added: number; projectCount: number }

        set((s) => ({
          registry: s.registry.map((e) =>
            e.id === s.activeWorkspaceId
              ? { ...e, projectCount: result.projectCount }
              : e
          ),
          activeWorkspace: s.activeWorkspace
            ? {
                ...s.activeWorkspace,
                projects: [
                  ...(s.activeWorkspace.projects || []),
                  ...projects.map((p) => ({
                    name: p.name,
                    capCutPath: p.capCutPath,
                    linkedAt: new Date().toISOString()
                  }))
                ]
              }
            : null
        }))

        return { added: result.added, projectCount: result.projectCount }
      },

      unlinkProjects: async (capCutPaths) => {
        const state = get()
        if (!state.activeWorkspaceId) throw new Error('No active workspace')

        const result = (await window.api.unlinkProjectsFromWorkspace({
          workspaceId: state.activeWorkspaceId,
          capCutPaths
        })) as { success: boolean; removed: number; projectCount: number }

        const pathSet = new Set(
          capCutPaths.map((p) => p.replace(/\\/g, '/').replace(/\/$/, ''))
        )
        set((s) => ({
          registry: s.registry.map((e) =>
            e.id === s.activeWorkspaceId
              ? { ...e, projectCount: result.projectCount }
              : e
          ),
          activeWorkspace: s.activeWorkspace
            ? {
                ...s.activeWorkspace,
                projects: (s.activeWorkspace.projects || []).filter(
                  (p) =>
                    !pathSet.has(
                      p.capCutPath.replace(/\\/g, '/').replace(/\/$/, '')
                    )
                )
              }
            : null
        }))

        return { removed: result.removed, projectCount: result.projectCount }
      },

      getSortedRegistry: () => {
        const { registry } = get()
        return [...registry].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          const aTime = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0
          const bTime = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0
          return bTime - aTime
        })
      }
    }),
    {
      name: 'meu-pipeline-workspace',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeWorkspaceId: state.activeWorkspaceId
      })
    }
  )
)
