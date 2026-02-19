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
  onConfirm: () => void
  onBack: () => void
}

export function SyncPreview({
  blocks,
  linkedCount,
  unlinkedCount,
  onConfirm,
  onBack
}: SyncPreviewProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">Resultado da sincronizacao</h3>
          <p className="text-xs text-text-muted">
            {linkedCount} blocos sincronizados
            {unlinkedCount > 0 && ` | ${unlinkedCount} sem audio`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
          >
            Confirmar sincronizacao
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              <th className="w-[48px] px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Texto</th>
              <th className="w-[88px] px-3 py-2.5 text-center">Status</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Inicio</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Fim</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr
                key={block.id}
                className="border-b border-border/50 transition-colors even:bg-surface/50 hover:bg-surface-hover"
              >
                <td className="px-3 py-2.5 tabular-nums text-text-muted">{block.index}</td>
                <td className="max-w-0 truncate px-3 py-2.5 text-text" title={block.text}>
                  {block.text}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      block.linkedAudioId
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {block.linkedAudioId ? 'Sync' : 'Sem audio'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.startMs)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.endMs)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.durationMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
