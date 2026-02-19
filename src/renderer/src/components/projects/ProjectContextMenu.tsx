import { useEffect, useRef } from 'react'
import { FolderOpen, Pencil, Trash2, Play, Save, Unlink } from 'lucide-react'

interface ProjectContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onOpenPipeline: () => void
  onRename: () => void
  onOpenExplorer: () => void
  onBackup: () => void
  onDelete: () => void
  onUnlink?: () => void
}

export function ProjectContextMenu({
  x,
  y,
  onClose,
  onOpenPipeline,
  onRename,
  onOpenExplorer,
  onBackup,
  onDelete,
  onUnlink
}: ProjectContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const clampedX = Math.min(x, window.innerWidth - 200)
  const clampedY = Math.min(y, window.innerHeight - 220)

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-lg border border-border bg-surface-2 py-1 shadow-popover"
      style={{ left: clampedX, top: clampedY }}
    >
      <button
        type="button"
        onClick={() => {
          onClose()
          onOpenPipeline()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
      >
        <Play className="h-3 w-3" /> Abrir no Pipeline
      </button>
      <button
        type="button"
        onClick={() => {
          onClose()
          onRename()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
      >
        <Pencil className="h-3 w-3" /> Renomear
      </button>
      <button
        type="button"
        onClick={() => {
          onClose()
          onOpenExplorer()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
      >
        <FolderOpen className="h-3 w-3" /> Abrir no Explorer
      </button>
      <button
        type="button"
        onClick={() => {
          onClose()
          onBackup()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
      >
        <Save className="h-3 w-3" /> Criar Backup
      </button>
      {onUnlink && (
        <>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => {
              onClose()
              onUnlink()
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-warning transition-colors hover:bg-surface-hover"
          >
            <Unlink className="h-3 w-3" /> Remover do Workspace
          </button>
        </>
      )}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        onClick={() => {
          onClose()
          onDelete()
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-error transition-colors hover:bg-surface-hover"
      >
        <Trash2 className="h-3 w-3" /> Excluir
      </button>
    </div>
  )
}
