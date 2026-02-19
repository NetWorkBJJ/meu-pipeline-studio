import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Loader2, Film, Check } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

interface AvailableProject {
  name: string
  path: string
  modifiedUs: number
  cover: string
}

interface ProjectPickerModalProps {
  open: boolean
  onClose: () => void
  onLink: (projects: Array<{ name: string; capCutPath: string }>) => Promise<void>
}

export function ProjectPickerModal({
  open,
  onClose,
  onLink
}: ProjectPickerModalProps): React.JSX.Element {
  const [available, setAvailable] = useState<AvailableProject[]>([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { activeWorkspaceId } = useWorkspaceStore()

  useEffect(() => {
    if (!open || !activeWorkspaceId) return
    setLoading(true)
    setSelected(new Set())
    setSearchQuery('')
    window.api
      .listAvailableProjects({ workspaceId: activeWorkspaceId })
      .then((raw) => {
        const mapped = (raw as Array<Record<string, unknown>>).map((p) => ({
          name: (p.name as string) || '',
          path: (p.path as string) || '',
          modifiedUs: (p.modified_us as number) || 0,
          cover: (p.cover as string) || ''
        }))
        setAvailable(mapped)
      })
      .catch(() => setAvailable([]))
      .finally(() => setLoading(false))
  }, [open, activeWorkspaceId])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return available
    const q = searchQuery.toLowerCase()
    return available.filter((p) => p.name.toLowerCase().includes(q))
  }, [available, searchQuery])

  const toggleSelect = (path: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleLink = async (): Promise<void> => {
    const projects = available
      .filter((p) => selected.has(p.path))
      .map((p) => ({ name: p.name, capCutPath: p.path }))
    if (projects.length === 0) return
    setLinking(true)
    try {
      await onLink(projects)
      onClose()
    } finally {
      setLinking(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Projetos ao Workspace">
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar projeto..."
            className="w-full rounded-lg border border-border bg-bg py-2 pl-8 pr-3 text-xs text-text placeholder:text-text-muted/50 outline-none focus:border-primary"
          />
        </div>

        {/* Project list */}
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-bg">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              {searchQuery
                ? 'Nenhum projeto encontrado'
                : 'Todos os projetos ja estao no workspace'}
            </div>
          ) : (
            filtered.map((project) => (
              <motion.div
                key={project.path}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSelect(project.path)}
                className={`flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-b-0 ${
                  selected.has(project.path) ? 'bg-primary/5' : 'hover:bg-surface-hover'
                }`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected.has(project.path)
                      ? 'border-primary bg-primary text-white'
                      : 'border-text-muted/30 bg-surface'
                  }`}
                >
                  {selected.has(project.path) && <Check className="h-2.5 w-2.5" />}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-surface">
                  {project.cover ? (
                    <img
                      src={`file:///${project.cover.replace(/\\/g, '/')}`}
                      alt=""
                      className="h-full w-full rounded object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <Film className="h-3.5 w-3.5 text-text-muted/30" />
                  )}
                </div>
                <span className="truncate text-xs font-medium text-text">{project.name}</span>
              </motion.div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-text-muted">
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleLink}
              disabled={selected.size === 0 || linking}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white gradient-primary shadow-glow-sm transition-shadow hover:shadow-glow disabled:opacity-40"
            >
              {linking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Adicionar ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
