import { useState } from 'react'
import { Film, CheckCircle2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { autoGroupScenes } from '@/lib/sceneGrouper'
import { msToDisplay } from '@/lib/time'
import { SceneList } from './SceneList'

export function Stage4Director(): React.JSX.Element {
  const [blocksPerScene, setBlocksPerScene] = useState(3)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const scenes = useProjectStore((s) => s.scenes)
  const videoSegments = useProjectStore((s) => s.videoSegments)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const { setScenes } = useProjectStore()
  const { completeStage } = useStageStore()
  const completedStages = useStageStore((s) => s.completedStages)
  const { addToast } = useUIStore()

  const hasExistingVideos = projectLoaded && videoSegments.length > 0
  const stageAlreadyComplete = completedStages.has(4)

  const handleAutoGroup = (): void => {
    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de texto disponivel.' })
      return
    }

    const grouped = autoGroupScenes(storyBlocks, blocksPerScene)
    setScenes(grouped)
    addToast({ type: 'success', message: `${grouped.length} cenas criadas.` })
  }

  const handleSkipWithVideos = (): void => {
    completeStage(4)
    addToast({
      type: 'success',
      message: `${videoSegments.length} videos existentes na timeline. Etapa 4 concluida.`
    })
  }

  const handleUpdateScene = (id: string, field: string, value: string): void => {
    const updated = scenes.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    setScenes(updated)
  }

  const handleConfirm = (): void => {
    if (scenes.length === 0) {
      addToast({ type: 'warning', message: 'Crie pelo menos uma cena antes de confirmar.' })
      return
    }
    completeStage(4)
    addToast({ type: 'success', message: 'Etapa 4 concluida. Avance para Midias.' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text">Direcao de Cenas</h3>
        <p className="text-xs text-text-muted mt-1">
          Agrupe os blocos de texto em cenas e defina o tipo de midia para cada uma.
        </p>
      </div>

      {/* Show existing video segments from CapCut */}
      {hasExistingVideos && !stageAlreadyComplete && scenes.length === 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Film className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text">
                {videoSegments.length} videos ja existem na timeline
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                O projeto CapCut ja possui midias posicionadas. Voce pode pular o agrupamento
                ou criar cenas para reorganizar.
              </p>
              <div className="mt-3 max-h-32 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {videoSegments.slice(0, 5).map((v) => (
                      <tr key={v.id} className="border-b border-border/30 last:border-0">
                        <td className="w-8 px-2 py-1.5 text-text-muted">{v.index}</td>
                        <td className="max-w-0 truncate px-2 py-1.5 font-mono text-text-muted">
                          {v.filePath.split(/[/\\]/).pop() || 'Video'}
                        </td>
                        <td className="w-14 px-2 py-1.5 text-right text-text-muted">{v.mediaType}</td>
                        <td className="w-16 px-2 py-1.5 text-right font-mono text-text-muted">
                          {msToDisplay(v.durationMs)}
                        </td>
                      </tr>
                    ))}
                    {videoSegments.length > 5 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-1.5 text-center text-text-muted">
                          +{videoSegments.length - 5} videos...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSkipWithVideos}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Manter videos existentes
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-xs text-text-muted">Blocos por cena:</label>
        <input
          type="number"
          min={1}
          max={10}
          value={blocksPerScene}
          onChange={(e) => setBlocksPerScene(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded-md border border-border bg-bg px-2 py-1.5 text-sm tabular-nums text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
        <button
          onClick={handleAutoGroup}
          disabled={storyBlocks.length === 0}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Agrupar automaticamente
        </button>
      </div>

      {scenes.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{scenes.length} cenas</span>
            <button
              onClick={handleConfirm}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
            >
              Confirmar cenas
            </button>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <SceneList scenes={scenes} onUpdateScene={handleUpdateScene} />
          </div>
        </>
      )}
    </div>
  )
}
