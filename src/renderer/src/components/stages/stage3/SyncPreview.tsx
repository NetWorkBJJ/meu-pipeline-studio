import { CheckCircle2, AlertTriangle, Minus } from 'lucide-react'
import { msToDisplay } from '@/lib/time'

interface SyncedBlock {
  id: string
  index: number
  text: string
  startMs: number
  endMs: number
  durationMs: number
  linkedAudioId: string | null
}

interface SyncPreviewProps {
  blocks: SyncedBlock[]
  linkedCount: number
  unlinkedCount: number
  gapsRemoved: number
  onConfirm: () => void
  onBack: () => void
}

export function SyncPreview({
  blocks,
  linkedCount,
  unlinkedCount,
  gapsRemoved,
  onConfirm,
  onBack
}: SyncPreviewProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <h3 className="text-sm font-medium text-text">Sincronizacao concluida</h3>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-success/20 bg-success/5 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-success/80">
            Alinhados
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-success">{linkedCount}</p>
        </div>
        {gapsRemoved > 0 && (
          <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Gaps removidos
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-text">{gapsRemoved}</p>
          </div>
        )}
        {unlinkedCount > 0 && (
          <div className="flex-1 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-warning/80">
              Sem audio
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">{unlinkedCount}</p>
          </div>
        )}
      </div>

      {/* Mismatch warning */}
      {unlinkedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-text-muted">
            {unlinkedCount} legenda{unlinkedCount > 1 ? 's' : ''} sem audio correspondente.
            Ajuste o roteiro no Stage 1 se necessario.
          </p>
        </div>
      )}

      {/* Alignment table */}
      <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              <th className="w-[48px] px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Legenda</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Inicio</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Fim</th>
              <th className="w-[80px] px-3 py-2.5 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => {
              const isLinked = block.linkedAudioId !== null
              return (
                <tr
                  key={block.id}
                  className={`border-b border-border/50 transition-colors hover:bg-surface-hover ${
                    isLinked ? 'even:bg-surface/50' : 'bg-warning/5'
                  }`}
                >
                  <td className="px-3 py-2.5 tabular-nums text-text-muted">{block.index}</td>
                  <td className="max-w-0 truncate px-3 py-2.5 text-text" title={block.text}>
                    {block.text}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                    {isLinked ? msToDisplay(block.startMs) : (
                      <Minus className="ml-auto h-3 w-3 text-text-muted/30" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                    {isLinked ? msToDisplay(block.endMs) : (
                      <Minus className="ml-auto h-3 w-3 text-text-muted/30" />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                    {isLinked ? msToDisplay(block.durationMs) : (
                      <Minus className="ml-auto h-3 w-3 text-text-muted/30" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
        >
          Refazer
        </button>
        <button
          onClick={onConfirm}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirmar
        </button>
      </div>
    </div>
  )
}
