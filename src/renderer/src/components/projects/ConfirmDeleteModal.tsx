import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { Modal } from '../shared/Modal'

interface ConfirmDeleteModalProps {
  open: boolean
  onClose: () => void
  projectNames: string[]
  projectPaths: string[]
  onConfirm: (paths: string[]) => Promise<void>
}

export function ConfirmDeleteModal({
  open,
  onClose,
  projectNames,
  projectPaths,
  onConfirm
}: ConfirmDeleteModalProps): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const isBulk = projectPaths.length >= 3
  const confirmTarget = String(projectPaths.length)
  const canConfirm = isBulk ? confirmText === confirmTarget : true

  useEffect(() => {
    if (open) {
      setConfirmText('')
      setDeleting(false)
    }
  }, [open])

  const handleDelete = async (): Promise<void> => {
    if (!canConfirm || deleting) return
    setDeleting(true)
    try {
      await onConfirm(projectPaths)
    } finally {
      setDeleting(false)
    }
  }

  const displayNames = projectNames.slice(0, 5)
  const remaining = projectNames.length - displayNames.length

  return (
    <Modal open={open} onClose={deleting ? () => {} : onClose} title="Excluir Projeto">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error/10">
            <AlertTriangle className="h-4 w-4 text-error" />
          </div>
          <div className="space-y-1 text-xs text-text-muted">
            <p>
              {projectPaths.length === 1
                ? 'Este projeto sera excluido permanentemente do disco.'
                : `Estes ${projectPaths.length} projetos serao excluidos permanentemente do disco.`}
            </p>
            <p className="font-medium text-error">Esta acao nao pode ser desfeita.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <ul className="space-y-1">
            {displayNames.map((name) => (
              <li key={name} className="text-xs text-text">
                {name}
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className="mt-1 text-xs text-text-muted">... e mais {remaining}</p>
          )}
        </div>

        {isBulk && (
          <div className="space-y-1.5">
            <label className="text-xs text-text-muted">
              Digite <span className="font-mono font-medium text-text">{confirmTarget}</span> para
              confirmar:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-border px-4 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm || deleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Excluir Permanentemente
          </button>
        </div>
      </div>
    </Modal>
  )
}
