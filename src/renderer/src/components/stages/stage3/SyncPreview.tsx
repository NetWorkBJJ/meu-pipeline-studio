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

export function SyncPreview({ blocks, linkedCount, unlinkedCount, onConfirm, onBack }: SyncPreviewProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">
            Resultado da sincronizacao
          </h3>
          <p className="text-xs text-text-muted">
            {linkedCount} blocos sincronizados
            {unlinkedCount > 0 && ` | ${unlinkedCount} sem audio`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Confirmar sincronizacao
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs text-text-muted">
              <th className="px-3 py-2 w-12">#</th>
              <th className="px-3 py-2">Texto</th>
              <th className="px-3 py-2 w-20 text-center">Status</th>
              <th className="px-3 py-2 w-24 text-right">Inicio</th>
              <th className="px-3 py-2 w-24 text-right">Fim</th>
              <th className="px-3 py-2 w-24 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={block.id} className="border-b border-border/50 hover:bg-surface-hover">
                <td className="px-3 py-2 text-text-muted">{block.index}</td>
                <td className="px-3 py-2 text-text max-w-sm truncate">{block.text}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    block.linkedAudioId
                      ? 'bg-success/10 text-success'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {block.linkedAudioId ? 'Sync' : 'Sem audio'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.startMs)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.endMs)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-text-muted">
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
