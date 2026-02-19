import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Folder, Pin, Star, MoreVertical, Pencil, Trash2, FolderOpen } from 'lucide-react'
import type { WorkspaceRegistryEntry } from '@/types/workspace'

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'nunca'
  const date = new Date(dateStr)
  const now = Date.now()
  const diff = now - date.getTime()
  if (diff < 0) return 'agora'
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)} sem`
  return `${Math.floor(days / 30)}m`
}

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
      {/* Badges row */}
      <div className="mb-3 flex items-center gap-1.5">
        {workspace.pinned && (
          <Pin className="h-3 w-3 text-primary" />
        )}
        {workspace.isDefault && (
          <span className="flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Star className="h-2.5 w-2.5" />
            Padrao
          </span>
        )}
        {workspace._missing && (
          <span className="text-[10px] text-error">pasta ausente</span>
        )}
        <div className="flex-1" />
        {/* Context menu button */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted/0 transition-colors group-hover:text-text-muted hover:!bg-surface hover:!text-text"
          >
            <MoreVertical className="h-3.5 w-3.5" />
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

      {/* Icon */}
      <div className="mb-3 flex h-16 items-center justify-center rounded-lg bg-background">
        <Folder className="h-8 w-8 text-primary/40" />
      </div>

      {/* Name */}
      <h3 className="mb-0.5 truncate text-sm font-semibold text-text" title={workspace.name}>
        {workspace.name}
      </h3>

      {/* Description */}
      {workspace.description && (
        <p className="mb-2 line-clamp-2 text-[11px] text-text-muted/70">{workspace.description}</p>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center gap-2 pt-2 text-[10px] text-text-muted/60">
        <span>
          {workspace.projectCount} projeto{workspace.projectCount !== 1 ? 's' : ''}
        </span>
        <span>|</span>
        <span>{formatRelativeDate(workspace.lastOpenedAt)}</span>
      </div>
    </motion.div>
  )
}
