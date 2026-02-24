import { Loader2, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { msToDisplay } from '@/lib/time'

interface BlocksPreviewProps {
  onConfirm: () => void
  onBack: () => void
  loading?: boolean
}

export function BlocksPreview({ onConfirm, onBack, loading }: BlocksPreviewProps): React.JSX.Element {
  const { storyBlocks, capCutDraftPath } = useProjectStore()

  const totalDurationMs = storyBlocks.length > 0 ? storyBlocks[storyBlocks.length - 1].endMs : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Warning: no project selected */}
      {!capCutDraftPath && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Selecione um projeto CapCut na tela inicial antes de confirmar.
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">{storyBlocks.length} blocos gerados</h3>
          <p className="text-xs text-text-muted">
            Duracao estimada: {msToDisplay(totalDurationMs)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBack}
            disabled={loading}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={storyBlocks.length === 0 || loading || !capCutDraftPath}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Inserindo...
              </>
            ) : (
              'Confirmar e inserir no CapCut'
            )}
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated text-left text-[11px] font-semibold text-text-tertiary">
              <th className="w-[48px] px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Texto</th>
              <th className="w-[72px] px-4 py-2.5 text-right">Chars</th>
              <th className="w-[88px] px-4 py-2.5 text-right">Inicio</th>
              <th className="w-[88px] px-4 py-2.5 text-right">Fim</th>
              <th className="w-[88px] px-4 py-2.5 text-right">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {storyBlocks.map((block) => (
              <tr
                key={block.id}
                className="border-b border-border/50 transition-colors even:bg-surface/50 hover:bg-surface-hover"
              >
                <td className="px-4 py-2.5 tabular-nums text-text-muted">{block.index}</td>
                <td className="max-w-0 truncate px-3 py-2.5 text-text" title={block.text}>
                  {block.text}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">
                  {block.characterCount}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.startMs)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-text-muted">
                  {msToDisplay(block.endMs)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-text-muted">
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
