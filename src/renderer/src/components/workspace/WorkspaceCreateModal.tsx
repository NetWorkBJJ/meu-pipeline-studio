import { useState } from 'react'
import { FolderOpen, Loader2 } from 'lucide-react'
import { Modal } from '../shared/Modal'

interface WorkspaceCreateModalProps {
  open: boolean
  onClose: () => void
  onCreate: (params: {
    name: string
    description: string
    path: string
    capCutProjectsPath: string
  }) => Promise<void>
}

const DEFAULT_CAPCUT_PATH =
  'C:/Users/ander/AppData/Local/CapCut/User Data/Projects/com.lveditor.draft'

export function WorkspaceCreateModal({
  open,
  onClose,
  onCreate
}: WorkspaceCreateModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [path, setPath] = useState('')
  const [capCutPath, setCapCutPath] = useState(DEFAULT_CAPCUT_PATH)
  const [creating, setCreating] = useState(false)

  const handleSelectPath = async (): Promise<void> => {
    const selected = await window.api.selectDirectory()
    if (selected) setPath(selected)
  }

  const handleSelectCapCutPath = async (): Promise<void> => {
    const selected = await window.api.selectDirectory()
    if (selected) setCapCutPath(selected)
  }

  const handleCreate = async (): Promise<void> => {
    if (!name.trim() || !path.trim()) return
    setCreating(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        path: path.trim(),
        capCutProjectsPath: capCutPath.trim()
      })
      setName('')
      setDescription('')
      setPath('')
      setCapCutPath(DEFAULT_CAPCUT_PATH)
      onClose()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Workspace">
      <div className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            placeholder="Meu Workspace"
            autoFocus
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-primary"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Descricao (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descricao do workspace..."
            rows={2}
            className="resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-primary"
          />
        </div>

        {/* Workspace path */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Pasta do Workspace</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-text-muted">
              {path || 'Selecionar pasta...'}
            </div>
            <button
              type="button"
              onClick={handleSelectPath}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Escolher
            </button>
          </div>
        </div>

        {/* CapCut projects path */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Pasta dos Projetos CapCut</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-text-muted">
              {capCutPath}
            </div>
            <button
              type="button"
              onClick={handleSelectCapCutPath}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Mudar
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || !path.trim() || creating}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white gradient-primary shadow-glow-sm transition-shadow hover:shadow-glow disabled:opacity-40"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar
          </button>
        </div>
      </div>
    </Modal>
  )
}
