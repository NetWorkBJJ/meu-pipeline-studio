import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  RefreshCw,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mic,
  Languages,
  FileText,
  Wand2,
  Music,
  Image,
  AudioLines,
  Volume2,
  Loader2,
  ListX,
  CheckSquare,
  Square,
  Coins
} from 'lucide-react'
import type {
  Ai33TaskResponse,
  Ai33TaskListResponse,
  Ai33TaskDeleteResponse,
  Ai33TaskStatus,
  Ai33TaskMetadata
} from '@/types/ai33'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5000
const DEFAULT_PAGE_SIZE = 10

const TASK_TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'tts', label: 'TTS' },
  { value: 'tts_minimax', label: 'TTS MiniMax' },
  { value: 'dubbing', label: 'Dubbing' },
  { value: 'stt', label: 'Speech-to-Text' },
  { value: 'sound_effect', label: 'Sound Effect' },
  { value: 'voice_changer', label: 'Voice Changer' },
  { value: 'voice_isolate', label: 'Voice Isolate' },
  { value: 'music', label: 'Music' },
  { value: 'image', label: 'Image' }
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTaskTypeIcon(type: string): React.ReactNode {
  const iconClass = 'h-4 w-4'
  switch (type) {
    case 'tts':
    case 'tts_minimax':
      return <Mic className={iconClass} />
    case 'dubbing':
      return <Languages className={iconClass} />
    case 'stt':
      return <FileText className={iconClass} />
    case 'sound_effect':
      return <Wand2 className={iconClass} />
    case 'voice_changer':
      return <AudioLines className={iconClass} />
    case 'voice_isolate':
      return <Volume2 className={iconClass} />
    case 'music':
      return <Music className={iconClass} />
    case 'image':
      return <Image className={iconClass} />
    default:
      return <FileText className={iconClass} />
  }
}

function getTaskTypeLabel(type: string): string {
  const found = TASK_TYPE_OPTIONS.find((o) => o.value === type)
  return found ? found.label : type
}

function getStatusColor(status: Ai33TaskStatus): string {
  switch (status) {
    case 'doing':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'done':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'error':
      return 'bg-red-500/20 text-red-400'
    default:
      return 'bg-zinc-500/20 text-zinc-400'
  }
}

function getStatusLabel(status: Ai33TaskStatus): string {
  switch (status) {
    case 'doing':
      return 'Em andamento'
    case 'done':
      return 'Concluido'
    case 'error':
      return 'Erro'
    default:
      return status
  }
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'agora'
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60)
    return `${m} min atras`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `${h}h atras`
  }
  const d = Math.floor(diffSec / 86400)
  return `${d}d atras`
}

function extractDownloadUrl(metadata: Ai33TaskMetadata): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>

  if (typeof m.audio_url === 'string') return m.audio_url
  if (typeof m.output_uri === 'string') return m.output_uri
  if (Array.isArray(m.audio_url) && m.audio_url.length > 0) return m.audio_url[0] as string
  if (typeof m.json_url === 'string') return m.json_url

  if (Array.isArray(m.result_images) && m.result_images.length > 0) {
    const first = m.result_images[0] as Record<string, unknown>
    if (typeof first.imageUrl === 'string') return first.imageUrl
  }

  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Ai33TaskManager(): React.JSX.Element {
  const [tasks, setTasks] = useState<Ai33TaskResponse[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{ refund: number } | null>(null)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // -----------------------------------------------------------------------
  // Fetch tasks
  // -----------------------------------------------------------------------

  const fetchTasks = useCallback(async () => {
    try {
      const params: { page?: number; limit?: number; type?: string } = {
        page,
        limit: DEFAULT_PAGE_SIZE
      }
      if (typeFilter) params.type = typeFilter

      const result = (await window.api.ai33ListTasks(params)) as Ai33TaskListResponse
      if (result && result.success) {
        setTasks(result.data || [])
        setTotal(result.total || 0)
        setError(null)
      } else {
        setError('Falha ao carregar tasks')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [page, typeFilter])

  // -----------------------------------------------------------------------
  // Initial load + filter/page changes
  // -----------------------------------------------------------------------

  useEffect(() => {
    setLoading(true)
    fetchTasks()
  }, [fetchTasks])

  // -----------------------------------------------------------------------
  // Auto-poll when there are "doing" tasks
  // -----------------------------------------------------------------------

  useEffect(() => {
    const hasDoingTasks = tasks.some((t) => t.status === 'doing')

    if (hasDoingTasks) {
      pollRef.current = setInterval(() => {
        fetchTasks()
      }, POLL_INTERVAL_MS)
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [tasks, fetchTasks])

  // -----------------------------------------------------------------------
  // Listen for real-time task progress events
  // -----------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = window.api.onAi33TaskProgress(() => {
      fetchTasks()
    })
    return unsubscribe
  }, [fetchTasks])

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  const toggleSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = (): void => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.id)))
    }
  }

  // -----------------------------------------------------------------------
  // Delete tasks
  // -----------------------------------------------------------------------

  const handleDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    setDeleteResult(null)

    try {
      const result = (await window.api.ai33DeleteTasks(
        Array.from(selectedIds)
      )) as Ai33TaskDeleteResponse

      if (result && result.success) {
        setDeleteResult({ refund: result.refund_credits })
        setSelectedIds(new Set())
        await fetchTasks()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar tasks')
    } finally {
      setDeleting(false)
    }
  }

  // -----------------------------------------------------------------------
  // Download file
  // -----------------------------------------------------------------------

  const handleDownload = async (task: Ai33TaskResponse): Promise<void> => {
    const url = extractDownloadUrl(task.metadata)
    if (!url) return

    setDownloadingIds((prev) => new Set(prev).add(task.id))

    try {
      await window.api.ai33DownloadFile({ url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar arquivo')
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))
  const canPrev = page > 1
  const canNext = page < totalPages

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">Tasks ai33.pro</h3>

        <div className="flex items-center gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          >
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Refresh button */}
          <button
            onClick={() => fetchTasks()}
            className="rounded-lg border border-border p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            title="Atualizar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <span className="text-xs text-text-muted">
            {selectedIds.size} selecionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-40"
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Deletar
          </button>
        </motion.div>
      )}

      {/* Refund notification */}
      <AnimatePresence>
        {deleteResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
          >
            <Coins className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">
              {deleteResult.refund} creditos reembolsados
            </span>
            <button
              onClick={() => setDeleteResult(null)}
              className="ml-auto text-xs text-emerald-400/60 hover:text-emerald-400"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && tasks.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-text-muted">Carregando tasks...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
          <ListX className="h-10 w-10 text-text-muted/40" />
          <p className="text-sm text-text-muted">Nenhuma task encontrada</p>
          <p className="text-xs text-text-muted/60">
            {typeFilter
              ? 'Tente remover o filtro de tipo'
              : 'Tasks aparecerao aqui ao usar servicos ai33.pro'}
          </p>
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {/* Table header */}
          <div className="sticky top-0 z-10 grid grid-cols-[28px_32px_1fr_90px_80px_60px_72px] items-center gap-2 rounded-t-lg bg-surface px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
            <button onClick={toggleSelectAll} className="flex items-center justify-center">
              {selectedIds.size === tasks.length && tasks.length > 0 ? (
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
            <span />
            <span>Task</span>
            <span>Status</span>
            <span>Criado</span>
            <span>Custo</span>
            <span />
          </div>

          {/* Task rows */}
          {tasks.map((task) => {
            const isExpanded = expandedId === task.id
            const isSelected = selectedIds.has(task.id)
            const downloadUrl = extractDownloadUrl(task.metadata)
            const isDownloading = downloadingIds.has(task.id)

            return (
              <div key={task.id} className="border-b border-border/50 last:border-b-0">
                {/* Main row */}
                <div
                  className={`grid grid-cols-[28px_32px_1fr_90px_80px_60px_72px] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-surface-hover ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(task.id)}
                    className="flex items-center justify-center"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-text-muted" />
                    )}
                  </button>

                  {/* Type icon */}
                  <span className="flex items-center justify-center text-text-muted" title={getTaskTypeLabel(task.type)}>
                    {getTaskTypeIcon(task.type)}
                  </span>

                  {/* Task ID + type label + expand toggle */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                    className="flex items-center gap-1.5 truncate text-left text-text hover:text-primary"
                  >
                    <span className="truncate font-mono text-[11px]">{task.id.slice(0, 12)}...</span>
                    <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
                      {getTaskTypeLabel(task.type)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3 shrink-0 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-3 w-3 shrink-0 text-text-muted" />
                    )}
                  </button>

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusColor(task.status)}`}
                    >
                      {getStatusLabel(task.status)}
                    </span>
                  </div>

                  {/* Created */}
                  <span className="text-text-muted" title={task.created_at}>
                    {formatRelativeTime(task.created_at)}
                  </span>

                  {/* Credit cost */}
                  <span className="text-text-muted">{task.credit_cost}</span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    {task.status === 'done' && downloadUrl && (
                      <button
                        onClick={() => handleDownload(task)}
                        disabled={isDownloading}
                        className="rounded p-1 text-text-muted transition-colors hover:bg-surface hover:text-primary disabled:opacity-40"
                        title="Baixar resultado"
                      >
                        {isDownloading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedIds(new Set([task.id]))
                        handleDelete()
                      }}
                      className="rounded p-1 text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                      title="Deletar task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar for "doing" tasks */}
                {task.status === 'doing' && (
                  <div className="px-3 pb-2">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                      <motion.div
                        className="h-full rounded-full bg-yellow-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="mt-0.5 block text-[10px] text-yellow-400/80">
                      {task.progress}%
                    </span>
                  </div>
                )}

                {/* Error message */}
                {task.status === 'error' && task.error_message && (
                  <div className="px-3 pb-2">
                    <p className="rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-400">
                      {task.error_message}
                    </p>
                  </div>
                )}

                {/* Expanded detail panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-3 mb-2 rounded-lg border border-border bg-bg p-3">
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Detalhes da Task
                        </h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                          <div>
                            <span className="text-text-muted">ID: </span>
                            <span className="font-mono text-text">{task.id}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Tipo: </span>
                            <span className="text-text">{getTaskTypeLabel(task.type)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Status: </span>
                            <span className="text-text">{getStatusLabel(task.status)}</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Progresso: </span>
                            <span className="text-text">{task.progress}%</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Custo: </span>
                            <span className="text-text">{task.credit_cost} creditos</span>
                          </div>
                          <div>
                            <span className="text-text-muted">Criado: </span>
                            <span className="text-text">
                              {new Date(task.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>

                        {/* Metadata JSON */}
                        {task.metadata &&
                          Object.keys(task.metadata).length > 0 && (
                            <div className="mt-3">
                              <h5 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                                Metadata
                              </h5>
                              <pre className="max-h-40 overflow-auto rounded bg-surface p-2 text-[10px] leading-relaxed text-text-muted">
                                {JSON.stringify(task.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {total > DEFAULT_PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-[11px] text-text-muted">
            {total} task{total !== 1 ? 's' : ''} no total
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev}
              className="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[60px] text-center text-xs text-text-muted">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!canNext}
              className="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
