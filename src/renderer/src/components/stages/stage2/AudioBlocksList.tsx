import { useProjectStore } from '@/stores/useProjectStore'
import { msToDisplay } from '@/lib/time'

interface AudioBlocksListProps {
  onConfirm: () => void
  onBack: () => void
}

export function AudioBlocksList({ onConfirm, onBack }: AudioBlocksListProps): React.JSX.Element {
  const { audioBlocks } = useProjectStore()

  const totalDurationMs = audioBlocks.length > 0 ? audioBlocks[audioBlocks.length - 1].endMs : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">
            {audioBlocks.length} blocos de audio detectados
          </h3>
          <p className="text-xs text-text-muted">Duracao total: {msToDisplay(totalDurationMs)}</p>
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
            disabled={audioBlocks.length === 0}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar audio
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs text-text-muted">
              <th className="px-3 py-2 w-12">#</th>
              <th className="px-3 py-2">Voz / Fonte</th>
              <th className="px-3 py-2 w-24 text-right">Inicio</th>
              <th className="px-3 py-2 w-24 text-right">Fim</th>
              <th className="px-3 py-2 w-24 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {audioBlocks.map((block) => (
              <tr key={block.id} className="border-b border-border/50 hover:bg-surface-hover">
                <td className="px-3 py-2 text-text-muted">{block.index}</td>
                <td className="px-3 py-2 text-text">
                  <span className="text-text-muted text-xs">
                    {block.source === 'capcut' ? 'CapCut TTS' : block.source}
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
