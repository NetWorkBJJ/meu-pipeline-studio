import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../shared/Modal'

interface ProjectCreateModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function ProjectCreateModal({
  open,
  onClose,
  onCreate
}: ProjectCreateModalProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async (): Promise<void> => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await onCreate(name.trim())
      setName('')
      onClose()
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Projeto CapCut">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Nome do Projeto</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Meu Projeto..."
            autoFocus
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-primary"
          />
        </div>

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
            disabled={!name.trim() || creating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all hover:bg-primary-hover disabled:opacity-40"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar
          </button>
        </div>
      </div>
    </Modal>
  )
}
