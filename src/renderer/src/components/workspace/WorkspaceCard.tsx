import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Folder, Pin, Star, MoreVertical, Pencil, Trash2, FolderOpen } from 'lucide-react'
import type { WorkspaceRegistryEntry } from '@/types/workspace'

interface WorkspaceCardProps {
  workspace: WorkspaceRegistryEntry
  onOpen: (id: string) => void
  onRename: (id: string) => void
  onSetDefault: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
  onOpenExplorer: (path: string) => void
  onDelete: (id: string) => void
}

export function WorkspaceCard({
  workspace,
  onOpen,
  onRename,
  onSetDefault,
  onPin,
  onOpenExplorer,
  onDelete
}: WorkspaceCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => !workspace._missing && onOpen(workspace.id)}
      className={`group relative flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
        workspace._missing
          ? 'cursor-not-allowed border-border/50 bg-surface/50 opacity-50'
          : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover hover:shadow-glow-sm'
      }`}
    >
      {/* Header row: icon + menu */}
      <div className="mb-3 flex items-center justify-between">
        <Folder className="h-5 w-5 text-primary" />
        {/* Context menu button */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted/0 transition-colors group-hover:text-text-muted hover:!bg-surface hover:!text-text"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-border bg-surface-2 py-1 shadow-popover">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onOpen(workspace.id)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <FolderOpen className="h-3 w-3" /> Abrir
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onRename(workspace.id)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <Pencil className="h-3 w-3" /> Renomear
              </button>
              {!workspace.isDefault && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onSetDefault(workspace.id)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
                >
                  <Star className="h-3 w-3" /> Definir como Padrao
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onPin(workspace.id, !workspace.pinned)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <Pin className="h-3 w-3" /> {workspace.pinned ? 'Desfixar' : 'Fixar'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onOpenExplorer(workspace.path)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-hover"
              >
                <Folder className="h-3 w-3" /> Abrir no Explorer
              </button>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  onDelete(workspace.id)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-error transition-colors hover:bg-surface-hover"
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <h3 className="mb-0.5 truncate text-[15px] font-semibold text-text" title={workspace.name}>
        {workspace.name}
      </h3>

      {/* Description */}
      {workspace.description && (
        <p className="mb-2 line-clamp-2 text-xs text-text-muted">{workspace.description}</p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center gap-3 pt-2 text-[11px] text-text-tertiary">
        <span>
          {workspace.projectCount} projeto{workspace.projectCount !== 1 ? 's' : ''}
        </span>
        {workspace.isDefault && (
          <span className="text-[10px] font-medium text-primary">Padrao</span>
        )}
        {workspace.pinned && (
          <Pin className="h-3 w-3 text-primary" />
        )}
        {workspace._missing && (
          <span className="text-[10px] text-error">pasta ausente</span>
        )}
      </div>
    </motion.div>
  )
}
