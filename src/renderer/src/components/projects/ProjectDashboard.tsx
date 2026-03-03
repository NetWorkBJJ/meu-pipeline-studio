import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  FolderOpen,
  Search,
  RefreshCw,
  Loader2,
  Film,
  AlertCircle,
  Clock,
  Trash2,
  Settings,
  X,
  Link,
  Layers,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react'
import { CapCutIcon } from '@/components/shared/CapCutIcon'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { ProjectCard } from './ProjectCard'
import { ProjectContextMenu } from './ProjectContextMenu'
import { ProjectCreateModal } from './ProjectCreateModal'
import { ProjectPickerModal } from './ProjectPickerModal'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { useStageStore } from '@/stores/useStageStore'
import type { PipelineStatus, WorkspaceRecentProject } from '@/types/workspace'

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

interface ProjectInfo {
  name: string
  path: string
  draftPath: string
  modifiedUs: number
  createdUs: number
  durationUs: number
  materialsSize: number
  cover: string
  exists: boolean
}

export function ProjectDashboard(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [multiSelect, setMultiSelect] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [pickerModalOpen, setPickerModalOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    project: ProjectInfo
  } | null>(null)
  const [deleteModal, setDeleteModal] = useState<{
    names: string[]
    paths: string[]
  } | null>(null)

  const {
    activeWorkspace,
    activeWorkspaceId,
    registry,
    closeWorkspace,
    saveRecentProjects,
    linkProjects,
    unlinkProjects
  } = useWorkspaceStore()
  const { setCapCutDraftPath, addRecentProject } = useProjectStore()
  const { setCurrentView, setSettingsOpen, addToast } = useUIStore()

  const isDefaultWorkspace =
    registry.find((e) => e.id === activeWorkspaceId)?.isDefault ?? true
  const recentProjects = activeWorkspace?.recentProjects || []
  const pipelineStatuses = activeWorkspace?.pipelineStatuses || {}

  const loadProjects = useCallback(async (): Promise<void> => {
    if (!activeWorkspace || !activeWorkspaceId) return
    setLoading(true)
    try {
      const raw = (await window.api.listWorkspaceProjects({
        workspaceId: activeWorkspaceId
      })) as Array<Record<string, unknown>>
      const mapped: ProjectInfo[] = raw.map((p) => ({
        name: (p.name as string) || '',
        path: (p.path as string) || '',
        draftPath: (p.draft_path as string) || '',
        modifiedUs: (p.modified_us as number) || 0,
        createdUs: (p.created_us as number) || 0,
        durationUs: (p.duration_us as number) || 0,
        materialsSize: (p.materials_size as number) || 0,
        cover: (p.cover as string) || '',
        exists: (p.exists as boolean) ?? true
      }))
      setProjects(mapped)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [activeWorkspace, activeWorkspaceId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    const q = searchQuery.toLowerCase()
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, searchQuery])

  const handleBack = (): void => {
    closeWorkspace()
    setCurrentView('workspaceSelector')
  }

  const triggerFullLoad = useCallback(
    async (draftPath: string): Promise<void> => {
      try {
        await useProjectStore.getState().loadFullProject(draftPath)
      } catch {
        addToast({ type: 'warning', message: 'Erro ao carregar dados do projeto.' })
      }
    },
    [addToast]
  )

  const tryLoadDirectorState = useCallback(
    async (draftPath: string): Promise<void> => {
      try {
        const raw = await window.api.loadDirectorState(draftPath)
        if (!raw) return
        const snapshot = JSON.parse(raw)
        if (!snapshot.scenes || snapshot.scenes.length === 0) return
        useProjectStore.getState().loadDirectorState(snapshot)
        addToast({ type: 'info', message: `${snapshot.scenes.length} cenas restauradas.` })
      } catch {
        // Corrupt snapshot, ignore silently
      }
    },
    [addToast]
  )

  const handleOpenProject = async (project: ProjectInfo): Promise<void> => {
    setCapCutDraftPath(project.draftPath)

    const recent: WorkspaceRecentProject = {
      name: project.name,
      path: project.draftPath,
      lastOpened: Date.now()
    }
    addRecentProject({ name: project.name, path: project.draftPath, lastOpened: Date.now() })

    const updated = [
      recent,
      ...recentProjects.filter((r) => normalizePath(r.path) !== normalizePath(project.draftPath))
    ].slice(0, 10)
    saveRecentProjects(updated)
    await tryLoadDirectorState(project.draftPath)
    setCurrentView('pipeline')
    triggerFullLoad(project.draftPath)
  }

  const handleSelectRecent = async (path: string): Promise<void> => {
    const project = projects.find((p) => p.draftPath === path)
    const name = project?.name || path.split('/').pop() || 'Projeto'
    setCapCutDraftPath(path)
    addRecentProject({ name, path, lastOpened: Date.now() })

    const recent: WorkspaceRecentProject = { name, path, lastOpened: Date.now() }
    const updated = [
      recent,
      ...recentProjects.filter((r) => normalizePath(r.path) !== normalizePath(path))
    ].slice(0, 10)
    saveRecentProjects(updated)
    await tryLoadDirectorState(path)
    setCurrentView('pipeline')
    triggerFullLoad(path)
  }

  const handleOpenFolder = async (): Promise<void> => {
    const path = await window.api.selectCapCutDraft()
    if (path) {
      setCapCutDraftPath(path)
      const parts = path.replace(/\\/g, '/').split('/')
      const name = parts[parts.length - 1] || parts[parts.length - 2] || 'Projeto'
      addRecentProject({ name, path, lastOpened: Date.now() })

      const recent: WorkspaceRecentProject = { name, path, lastOpened: Date.now() }
      const updated = [
        recent,
        ...recentProjects.filter((r) => normalizePath(r.path) !== normalizePath(path))
      ].slice(0, 10)
      saveRecentProjects(updated)
      await tryLoadDirectorState(path)
      setCurrentView('pipeline')
      triggerFullLoad(path)
    }
  }

  const handleCreateProject = async (name: string): Promise<void> => {
    try {
      const result = (await window.api.createCapCutProject(name)) as {
        project_path: string
        draft_path: string
      }
      addToast({ type: 'success', message: `Projeto "${name}" criado!` })
      setCapCutDraftPath(result.draft_path)
      addRecentProject({ name, path: result.draft_path, lastOpened: Date.now() })

      if (!isDefaultWorkspace && activeWorkspaceId) {
        await linkProjects([{ name, capCutPath: result.project_path }])
      }

      const recent: WorkspaceRecentProject = {
        name,
        path: result.draft_path,
        lastOpened: Date.now()
      }
      const updated = [
        recent,
        ...recentProjects.filter(
          (r) => normalizePath(r.path) !== normalizePath(result.draft_path)
        )
      ].slice(0, 10)
      saveRecentProjects(updated)
      setCurrentView('pipeline')
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao criar projeto'
      })
    }
  }

  const handleContextMenu = (e: React.MouseEvent, project: ProjectInfo): void => {
    setContextMenu({ x: e.clientX, y: e.clientY, project })
  }

  const handleOpenExplorer = async (path: string): Promise<void> => {
    try {
      await window.api.openInExplorer(path)
    } catch {
      // silent
    }
  }

  const handleBackup = async (draftPath: string): Promise<void> => {
    try {
      await window.api.createBackup(draftPath)
      addToast({ type: 'success', message: 'Backup criado.' })
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao criar backup'
      })
    }
  }

  const handleDeleteSelected = (): void => {
    const selected = projects.filter((p) => selectedPaths.has(p.path))
    if (selected.length === 0) return
    setDeleteModal({
      names: selected.map((p) => p.name),
      paths: selected.map((p) => p.path)
    })
  }

  const handleDeleteProjects = async (paths: string[]): Promise<void> => {
    try {
      const result = await window.api.deleteCapCutProjects(paths)

      if (result.totalDeleted === result.totalRequested) {
        addToast({
          type: 'success',
          message:
            result.totalDeleted === 1
              ? 'Projeto excluido com sucesso.'
              : `${result.totalDeleted} projetos excluidos com sucesso.`
        })
      } else if (result.totalDeleted > 0) {
        addToast({
          type: 'warning',
          message: `${result.totalDeleted} excluido(s), ${result.totalRequested - result.totalDeleted} falha(s).`
        })
      } else {
        const firstError = result.results.find((r) => !r.success)
        addToast({
          type: 'error',
          message: firstError?.error || 'Erro ao excluir projetos.'
        })
      }

      // Clean up references
      const deletedPaths = result.results.filter((r) => r.success).map((r) => r.path)
      if (deletedPaths.length > 0) {
        cleanupAfterDelete(deletedPaths)
      }

      loadProjects()
      setSelectedPaths(new Set())
      setMultiSelect(false)
      setDeleteModal(null)
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao excluir projetos'
      })
    }
  }

  const cleanupAfterDelete = (deletedPaths: string[]): void => {
    const normalized = deletedPaths.map((p) => p.replace(/\\/g, '/'))

    // Clean workspace recentProjects
    const updatedRecent = recentProjects.filter(
      (r) => !normalized.some((dp) => r.path.replace(/\\/g, '/').startsWith(dp))
    )
    if (updatedRecent.length !== recentProjects.length) {
      saveRecentProjects(updatedRecent)
    }

    // Clean project store recentProjects
    const projectStore = useProjectStore.getState()
    for (const dp of normalized) {
      projectStore.recentProjects
        .filter((rp) => rp.path.replace(/\\/g, '/').startsWith(dp))
        .forEach((rp) => projectStore.removeRecentProject(rp.path))
    }

    // Reset pipeline if current project was deleted
    const currentDraft = projectStore.capCutDraftPath
    if (currentDraft) {
      const normalizedDraft = currentDraft.replace(/\\/g, '/')
      if (normalized.some((dp) => normalizedDraft.startsWith(dp))) {
        projectStore.resetProject()
        useStageStore.getState().reset()
      }
    }

    // Unlink from custom workspace
    if (!isDefaultWorkspace) {
      try {
        unlinkProjects(deletedPaths)
      } catch {
        // silent - folder is already gone
      }
    }
  }

  const toggleSelect = (path: string): void => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleUnlinkProject = async (projectPath: string): Promise<void> => {
    if (isDefaultWorkspace) return
    try {
      await unlinkProjects([projectPath])
      addToast({ type: 'success', message: 'Projeto removido do workspace.' })
      loadProjects()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao remover projeto'
      })
    }
  }

  const handleLinkProjects = async (
    selected: Array<{ name: string; capCutPath: string }>
  ): Promise<void> => {
    try {
      const result = await linkProjects(selected)
      addToast({
        type: 'success',
        message: `${result.added} projeto${result.added !== 1 ? 's' : ''} adicionado${result.added !== 1 ? 's' : ''}.`
      })
      loadProjects()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao vincular projetos'
      })
    }
  }

  const handleRemoveRecent = async (path: string): Promise<void> => {
    const updated = recentProjects.filter((r) => normalizePath(r.path) !== normalizePath(path))
    await saveRecentProjects(updated)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center top, rgba(99, 102, 241, 0.04) 0%, transparent 70%)'
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface hover:text-text"
            title="Voltar aos workspaces"
          >
            <ArrowLeft className="h-4 w-4" />
          </motion.button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold text-text">Pipeline Studio</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const result = await window.api.openCapCut()
              if (!result.success) {
                addToast({ type: 'error', message: result.error || 'Erro ao abrir CapCut.' })
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-elevated text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            title="Abrir CapCut"
          >
            <CapCutIcon className="h-[18px] w-[18px]" />
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setCurrentView('pipeline')
              useStageStore.getState().setCurrentStage(5)
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-elevated text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            title="VEO3 Flow"
          >
            <Sparkles className="h-[18px] w-[18px]" />
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-elevated text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            title="Configuracoes"
          >
            <Settings className="h-[18px] w-[18px]" />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-8 pt-8 pb-6">
        {/* Title row: title left, action button right */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text">Meus Projetos</h1>
            <p className="mt-2 text-sm text-text-muted">
              {activeWorkspace?.name || 'Workspace'}
              {projects.length > 0 && ` \u2014 ${projects.length} projeto${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white gradient-primary shadow-glow-sm transition-shadow hover:shadow-glow"
            >
              <Plus className="h-4 w-4" />
              Novo Projeto
            </button>
          </div>
        </div>

        {/* Search row */}
        <div className="mb-8 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar projetos..."
              className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-text placeholder:text-text-tertiary outline-none transition-colors focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleOpenFolder}
            className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <FolderOpen className="h-4 w-4" />
            Abrir Pasta
          </button>
          {!isDefaultWorkspace && (
            <button
              type="button"
              onClick={() => setPickerModalOpen(true)}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Link className="h-4 w-4" />
              Adicionar
            </button>
          )}
          {!multiSelect ? (
            <button
              type="button"
              onClick={() => setMultiSelect(true)}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                {selectedPaths.size} selecionado{selectedPaths.size !== 1 ? 's' : ''}
              </span>
              {selectedPaths.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="flex h-10 items-center gap-1 rounded-lg border border-error/30 px-3 text-xs text-error hover:bg-error/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMultiSelect(false)
                  setSelectedPaths(new Set())
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => loadProjects()}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-40"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && !searchQuery && (
          <div className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-muted">
              <Clock className="h-3 w-3" />
              Recentes
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {recentProjects.map((recent) => (
                <motion.div
                  key={recent.path}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group flex min-w-[180px] max-w-[220px] shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary/40 hover:bg-surface-hover"
                  onClick={() => handleSelectRecent(recent.path)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Film className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="truncate text-xs font-medium text-text">{recent.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveRecent(recent.path)
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted/0 transition-colors group-hover:text-text-muted hover:!text-error"
                    title="Remover"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Projects grid */}
        {loading && projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Loader2 className="mb-3 h-6 w-6 animate-spin" />
            <span className="text-sm">Carregando projetos...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <AlertCircle className="mb-3 h-6 w-6 opacity-40" />
            <span className="text-sm">
              {searchQuery
                ? 'Nenhum projeto encontrado'
                : isDefaultWorkspace
                  ? 'Nenhum projeto CapCut encontrado'
                  : 'Nenhum projeto vinculado. Use "Adicionar" para vincular projetos CapCut.'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {filteredProjects.map((project, i) => (
                <motion.div
                  key={project.path || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                >
                  <ProjectCard
                    name={project.name}
                    path={project.path}
                    draftPath={project.draftPath}
                    durationUs={project.durationUs}
                    modifiedUs={project.modifiedUs}
                    cover={project.cover}
                    exists={project.exists}
                    pipelineStatus={
                      (pipelineStatuses[project.draftPath] as PipelineStatus) || null
                    }
                    multiSelect={multiSelect}
                    selected={selectedPaths.has(project.path)}
                    onSelect={() => toggleSelect(project.path)}
                    onClick={() => handleOpenProject(project)}
                    onContextMenu={(e) => handleContextMenu(e, project)}
                  />
                </motion.div>
              ))}
            </div>
          )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ProjectContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onOpenPipeline={() => handleOpenProject(contextMenu.project)}
            onRename={() => {
              addToast({
                type: 'info',
                message: 'Renomear projeto nao suportado (gerenciado pelo CapCut).'
              })
            }}
            onOpenExplorer={() => handleOpenExplorer(contextMenu.project.path)}
            onBackup={() => handleBackup(contextMenu.project.draftPath)}
            onDelete={() => {
              setContextMenu(null)
              setDeleteModal({
                names: [contextMenu.project.name],
                paths: [contextMenu.project.path]
              })
            }}
            onUnlink={
              !isDefaultWorkspace
                ? () => handleUnlinkProject(contextMenu.project.path)
                : undefined
            }
          />
        )}
      </AnimatePresence>

      <ProjectCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateProject}
      />

      {!isDefaultWorkspace && (
        <ProjectPickerModal
          open={pickerModalOpen}
          onClose={() => setPickerModalOpen(false)}
          onLink={handleLinkProjects}
        />
      )}

      <ConfirmDeleteModal
        open={deleteModal !== null}
        onClose={() => setDeleteModal(null)}
        projectNames={deleteModal?.names || []}
        projectPaths={deleteModal?.paths || []}
        onConfirm={handleDeleteProjects}
      />
    </div>
  )
}
