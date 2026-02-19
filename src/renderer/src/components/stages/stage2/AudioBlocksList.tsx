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
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={audioBlocks.length === 0}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar audio
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              <th className="w-[48px] px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">Voz / Fonte</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Inicio</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Fim</th>
              <th className="w-[88px] px-3 py-2.5 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {audioBlocks.map((block) => (
              <tr
                key={block.id}
                className="border-b border-border/50 transition-colors even:bg-surface/50 hover:bg-surface-hover"
              >
                <td className="px-3 py-2.5 tabular-nums text-text-muted">{block.index}</td>
                <td className="px-3 py-2.5 text-text">
                  <span className="text-text-muted text-xs">
                    {block.source === 'capcut' ? 'CapCut TTS' : block.source}
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
