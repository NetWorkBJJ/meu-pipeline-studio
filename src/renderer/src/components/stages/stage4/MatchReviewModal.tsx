import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, FileQuestion } from 'lucide-react'

interface MatchResult {
  scene_id: string
  scene_index: number
  media_path: string
  confidence: number
  match_reason: string
}

interface MatchReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (matches: MatchResult[]) => void
  matches: MatchResult[]
  unmatchedFiles: string[]
  unmatchedScenes: Array<{ id: string; index: number }>
}

export function MatchReviewModal({
  isOpen,
  onClose,
  onConfirm,
  matches,
  unmatchedFiles,
  unmatchedScenes
}: MatchReviewModalProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-xl border border-border bg-bg p-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text">Resultado do matching</h3>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-text-muted transition-colors hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg border border-success/30 bg-success/5 p-2 text-center">
                <CheckCircle2 className="mx-auto h-4 w-4 text-success mb-1" />
                <div className="text-sm font-medium text-success">{matches.length}</div>
                <div className="text-[10px] text-text-muted">Associados</div>
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-2 text-center">
                <FileQuestion className="mx-auto h-4 w-4 text-warning mb-1" />
                <div className="text-sm font-medium text-warning">{unmatchedFiles.length}</div>
                <div className="text-[10px] text-text-muted">Arquivos sem cena</div>
              </div>
              <div className="rounded-lg border border-error/30 bg-error/5 p-2 text-center">
                <AlertCircle className="mx-auto h-4 w-4 text-error mb-1" />
                <div className="text-sm font-medium text-error">{unmatchedScenes.length}</div>
                <div className="text-[10px] text-text-muted">Cenas sem midia</div>
              </div>
            </div>

            {/* Matches list */}
            <div className="max-h-64 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-3 py-2 text-left font-medium text-text-muted">Cena</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">Arquivo</th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">Confianca</th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">Metodo</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.scene_id} className="border-b border-border/30 last:border-0">
                      <td className="px-3 py-1.5 text-text">Cena {m.scene_index}</td>
                      <td className="max-w-0 truncate px-3 py-1.5 font-mono text-text-muted">
                        {m.media_path.split(/[/\\]/).pop()}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            m.confidence >= 0.9
                              ? 'bg-success/10 text-success'
                              : m.confidence >= 0.5
                                ? 'bg-warning/10 text-warning'
                                : 'bg-error/10 text-error'
                          }`}
                        >
                          {Math.round(m.confidence * 100)}%
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-text-muted">
                        {m.match_reason === 'filename_convention'
                          ? 'Nome'
                          : m.match_reason === 'sequential_fallback'
                            ? 'Sequencial'
                            : m.match_reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unmatched scenes */}
            {unmatchedScenes.length > 0 && (
              <div className="mt-3">
                <span className="text-[10px] text-error">
                  Cenas sem midia: {unmatchedScenes.map((s) => s.index).join(', ')}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border">
              <button
                onClick={onClose}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface/80"
              >
                Cancelar
              </button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onConfirm(matches)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirmar associacoes
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
