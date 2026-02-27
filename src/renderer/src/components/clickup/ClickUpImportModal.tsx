import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  X,
  Download,
  Loader2,
  FileText,
  Image,
  File,
  Check,
  AlertTriangle
} from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { ClickUpBrowser } from './ClickUpBrowser'
import type { ClickUpTask, ClickUpAttachment } from '@/types/clickup'
import { classifyAttachment, SCRIPT_EXTENSIONS } from '@/types/clickup'

interface ClickUpImportModalProps {
  onClose: () => void
  onImported?: () => void
}

export function ClickUpImportModal({
  onClose,
  onImported
}: ClickUpImportModalProps): React.JSX.Element {
  const { addToast } = useUIStore()
  const { setRawScript, setClickUpTaskRef } = useProjectStore()

  const [selectedTask, setSelectedTask] = useState<ClickUpTask | null>(null)
  const [selectedScript, setSelectedScript] = useState<ClickUpAttachment | null>(null)
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  const handleTaskSelected = (task: ClickUpTask): void => {
    setSelectedTask(task)
    setSelectedScript(null)
    setSelectedCharacters(new Set())

    // Auto-select first script attachment
    const scripts = (task.attachments || []).filter(
      (a) => classifyAttachment(a) === 'script'
    )
    if (scripts.length === 1) {
      setSelectedScript(scripts[0])
    }

    // Auto-select all character attachments
    const chars = (task.attachments || []).filter(
      (a) => classifyAttachment(a) === 'character'
    )
    setSelectedCharacters(new Set(chars.map((c) => c.id)))
  }

  const toggleCharacter = (id: string): void => {
    setSelectedCharacters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleImport = async (): Promise<void> => {
    if (!selectedTask || !selectedScript) return

    setImporting(true)
    try {
      // 1. Download script
      const ext = (selectedScript.extension || '').toLowerCase().replace(/^\./, '')
      if (!SCRIPT_EXTENSIONS.includes(ext)) {
        addToast({
          type: 'error',
          message: `Formato .${ext} nao suportado. Converta para .txt ou .md.`
        })
        return
      }

      const dlResult = (await window.api.clickupDownloadAttachment({
        url: selectedScript.url_w_query || selectedScript.url,
        fileName: selectedScript.title
      })) as { localPath: string; size: number }

      // 2. Read text content
      const scriptText = (await window.api.clickupReadTextFile(
        dlResult.localPath
      )) as string

      if (!scriptText.trim()) {
        addToast({ type: 'warning', message: 'Arquivo de roteiro esta vazio.' })
        return
      }

      // 3. Set rawScript
      setRawScript(scriptText)

      // 4. Download character files (if any selected)
      if (selectedCharacters.size > 0) {
        const charAttachments = (selectedTask.attachments || []).filter(
          (a) => selectedCharacters.has(a.id)
        )
        await window.api.clickupDownloadTaskAttachments({
          attachments: charAttachments.map((a) => ({
            url: a.url_w_query || a.url,
            fileName: a.title
          }))
        })
      }

      // 5. Set ClickUp task reference
      setClickUpTaskRef({
        taskId: selectedTask.id,
        taskName: selectedTask.name,
        listId: selectedTask.list?.id || '',
        listName: selectedTask.list?.name || '',
        url: selectedTask.url || '',
        importedAt: Date.now()
      })

      addToast({
        type: 'success',
        message: `Demanda importada: ${selectedTask.name}`
      })

      onImported?.()
      onClose()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao importar demanda'
      })
    } finally {
      setImporting(false)
    }
  }

  const attachments = selectedTask?.attachments || []
  const scripts = attachments.filter((a) => classifyAttachment(a) === 'script')
  const characters = attachments.filter((a) => classifyAttachment(a) === 'character')
  const others = attachments.filter((a) => classifyAttachment(a) === 'other')

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-surface-2 shadow-popover"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-text">Importar do ClickUp</h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body - split layout */}
          <div className="flex flex-1 min-h-0">
            {/* Left: Browser */}
            <div className="w-1/2 overflow-y-auto border-r border-border p-4">
              <ClickUpBrowser
                onTaskSelected={handleTaskSelected}
                selectedTaskId={selectedTask?.id || null}
              />
            </div>

            {/* Right: Task Detail */}
            <div className="w-1/2 overflow-y-auto p-4">
              {selectedTask ? (
                <div className="flex flex-col gap-4">
                  {/* Task header */}
                  <div>
                    <h3 className="text-sm font-medium text-text">
                      {selectedTask.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      {selectedTask.status && (
                        <>
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: selectedTask.status.color || '#71717A'
                            }}
                          />
                          <span className="text-xs text-text-muted">
                            {selectedTask.status.status}
                          </span>
                        </>
                      )}
                      {selectedTask.list?.name && (
                        <span className="text-xs text-text-muted">
                          | {selectedTask.list.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description preview */}
                  {selectedTask.description && (
                    <div className="rounded-lg border border-border bg-bg p-2.5">
                      <p className="max-h-20 overflow-hidden text-xs leading-relaxed text-text-muted">
                        {selectedTask.description.slice(0, 300)}
                        {selectedTask.description.length > 300 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  {/* Attachments */}
                  {attachments.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-bg py-6">
                      <AlertTriangle className="h-5 w-5 text-text-muted/50" />
                      <p className="text-xs text-text-muted">
                        Nenhum anexo nesta tarefa
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Scripts */}
                      {scripts.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                            Roteiros ({scripts.length})
                          </span>
                          {scripts.map((att) => (
                            <AttachmentRow
                              key={att.id}
                              attachment={att}
                              icon={
                                <FileText className="h-3.5 w-3.5 text-primary" />
                              }
                              selected={selectedScript?.id === att.id}
                              onToggle={() => setSelectedScript(att)}
                              type="radio"
                            />
                          ))}
                        </div>
                      )}

                      {/* Characters */}
                      {characters.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                            Personagens ({characters.length})
                          </span>
                          {characters.map((att) => (
                            <AttachmentRow
                              key={att.id}
                              attachment={att}
                              icon={
                                <Image className="h-3.5 w-3.5 text-emerald-400" />
                              }
                              selected={selectedCharacters.has(att.id)}
                              onToggle={() => toggleCharacter(att.id)}
                              type="checkbox"
                            />
                          ))}
                        </div>
                      )}

                      {/* Others */}
                      {others.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                            Outros ({others.length})
                          </span>
                          {others.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center gap-2 rounded-md border border-border/50 bg-bg px-2.5 py-1.5"
                            >
                              <File className="h-3.5 w-3.5 text-text-muted/50" />
                              <span className="flex-1 truncate text-xs text-text-muted">
                                {att.title}
                              </span>
                              <span className="text-[10px] text-text-muted/50">
                                .{att.extension}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {scripts.length === 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                          <p className="text-xs text-warning">
                            Nenhum roteiro (.txt, .md) encontrado nos anexos.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-xs">Selecione uma tarefa para ver detalhes</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <div className="text-xs text-text-muted">
              {selectedTask && (
                <span>
                  {selectedScript ? '1 roteiro' : '0 roteiros'}
                  {selectedCharacters.size > 0 &&
                    ` + ${selectedCharacters.size} personage${selectedCharacters.size > 1 ? 'ns' : 'm'}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!selectedTask || !selectedScript || importing}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Importar Demanda
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// Attachment row sub-component
// ---------------------------------------------------------------------------

function AttachmentRow({
  attachment,
  icon,
  selected,
  onToggle,
  type
}: {
  attachment: ClickUpAttachment
  icon: React.ReactNode
  selected: boolean
  onToggle: () => void
  type: 'radio' | 'checkbox'
}): React.JSX.Element {
  const sizeKB = Math.round((attachment.size || 0) / 1024)

  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
        selected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border/50 bg-bg hover:border-border'
      }`}
    >
      {type === 'checkbox' ? (
        <div
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
            selected ? 'border-primary bg-primary' : 'border-border'
          }`}
        >
          {selected && <Check className="h-2.5 w-2.5 text-white" />}
        </div>
      ) : (
        <div
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
            selected ? 'border-primary' : 'border-border'
          }`}
        >
          {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
      )}
      {icon}
      <span className="flex-1 truncate text-xs text-text">{attachment.title}</span>
      <span className="text-[10px] text-text-muted">
        {sizeKB > 0 ? `${sizeKB} KB` : ''}
      </span>
    </button>
  )
}
