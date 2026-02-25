import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Loader2, Plus, Folder, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'
import { useUIStore } from '@/stores/useUIStore'
import { WorkspaceCard } from '../workspace/WorkspaceCard'
import { WorkspaceCreateModal } from '../workspace/WorkspaceCreateModal'
import { Modal } from '../shared/Modal'

export function WorkspaceSelectorScreen(): React.JSX.Element {
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const {
    registryLoading,
    loadRegistry,
    openWorkspace,
    createWorkspace,
    deleteWorkspace,
    pinWorkspace,
    setDefaultWorkspace,
    updateWorkspace,
    getSortedRegistry
  } = useWorkspaceStore()
  const { setCurrentView, setSettingsOpen, addToast } = useUIStore()

  const sortedRegistry = getSortedRegistry()

  useEffect(() => {
    loadRegistry()
  }, [loadRegistry])

  const handleOpenWorkspace = async (id: string): Promise<void> => {
    try {
      await openWorkspace(id)
      setCurrentView('projectDashboard')
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao abrir workspace'
      })
    }
  }

  const handleCreateWorkspace = async (params: {
    name: string
    description: string
    path: string
    capCutProjectsPath: string
  }): Promise<void> => {
    try {
      await createWorkspace(params)
      addToast({ type: 'success', message: `Workspace "${params.name}" criado!` })
      setCurrentView('projectDashboard')
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao criar workspace'
      })
    }
  }

  const handleDeleteWorkspace = (id: string): void => {
    const workspace = sortedRegistry.find((w) => w.id === id)
    if (!workspace) return
    setDeleteTarget({ id, name: workspace.name })
  }

  const confirmDeleteWorkspace = async (): Promise<void> => {
    if (!deleteTarget) return
    try {
      await deleteWorkspace(deleteTarget.id)
      addToast({ type: 'success', message: 'Workspace excluido.' })
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao excluir workspace'
      })
    }
    setDeleteTarget(null)
  }

  const handleRename = (id: string): void => {
    const workspace = sortedRegistry.find((w) => w.id === id)
    if (!workspace) return
    setRenameId(id)
    setRenameValue(workspace.name)
  }

  const handleRenameSubmit = async (): Promise<void> => {
    if (!renameId || !renameValue.trim()) return
    try {
      await updateWorkspace({ id: renameId, name: renameValue.trim() })
      addToast({ type: 'success', message: 'Workspace renomeado.' })
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao renomear'
      })
    }
    setRenameId(null)
    setRenameValue('')
  }

  const handlePin = async (id: string, pinned: boolean): Promise<void> => {
    try {
      await pinWorkspace(id, pinned)
    } catch {
      // silent
    }
  }

  const handleSetDefault = async (id: string): Promise<void> => {
    try {
      await setDefaultWorkspace(id)
      addToast({ type: 'success', message: 'Workspace padrao definido.' })
    } catch {
      // silent
    }
  }

  const handleOpenExplorer = async (path: string): Promise<void> => {
    try {
      await window.api.openInExplorer(path)
    } catch {
      // silent
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Radial glow background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center top, rgba(99, 102, 241, 0.06) 0%, transparent 70%)'
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-text">Pipeline Studio</h1>
            <p className="text-[11px] text-text-tertiary">
              Pre-edicao automatizada para CapCut
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center text-text-muted transition-colors hover:text-text"
          title="Configuracoes"
        >
          <Settings className="h-[18px] w-[18px]" />
        </motion.button>
      </div>

      {/* Action bar */}
      <div className="relative z-10 flex items-center gap-3 px-6 pt-5 pb-3">
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white gradient-primary shadow-glow-sm transition-shadow hover:shadow-glow"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo Workspace
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6 pt-3">
        {registryLoading && sortedRegistry.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Loader2 className="mb-2 h-5 w-5 animate-spin" />
            <span className="text-xs">Carregando workspaces...</span>
          </div>
        ) : sortedRegistry.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Folder className="mb-3 h-12 w-12 text-text-muted/20" />
            <h2 className="mb-1 text-sm font-medium text-text">Nenhum workspace</h2>
            <p className="mb-4 text-xs text-text-muted">
              Crie seu primeiro workspace para organizar seus projetos.
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white gradient-primary shadow-glow-sm transition-shadow hover:shadow-glow"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {sortedRegistry.map((workspace, i) => (
              <motion.div
                key={workspace.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
              >
                <WorkspaceCard
                  workspace={workspace}
                  onOpen={handleOpenWorkspace}
                  onRename={handleRename}
                  onSetDefault={handleSetDefault}
                  onPin={handlePin}
                  onOpenExplorer={handleOpenExplorer}
                  onDelete={handleDeleteWorkspace}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Rename inline dialog */}
      {renameId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setRenameId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-surface-2 p-5 shadow-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-text">Renomear Workspace</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setRenameId(null)
              }}
              autoFocus
              className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenameId(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRenameSubmit}
                disabled={!renameValue.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-40"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir Workspace"
      >
        <p className="text-xs text-text-muted">
          Tem certeza que deseja excluir o workspace{' '}
          <span className="font-semibold text-text">{deleteTarget?.name}</span>?
        </p>
        <p className="mt-2 text-xs text-text-muted/70">
          Isso remove apenas o registro. Os arquivos do projeto nao serao apagados.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDeleteWorkspace}
            className="flex items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-xs font-medium text-white hover:bg-error/80"
          >
            <Trash2 className="h-3 w-3" />
            Excluir
          </button>
        </div>
      </Modal>

      <WorkspaceCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateWorkspace}
      />

      {/* Footer */}
      <div className="relative z-10 flex h-8 items-center justify-end border-t border-border px-6">
        <span className="text-[11px] text-text-tertiary">v0.1.0</span>
      </div>
    </div>
  )
}
