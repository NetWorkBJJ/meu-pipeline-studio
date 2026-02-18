import { useState } from 'react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { autoGroupScenes } from '@/lib/sceneGrouper'
import { SceneList } from './SceneList'

export function Stage4Director(): React.JSX.Element {
  const [blocksPerScene, setBlocksPerScene] = useState(3)
  const { storyBlocks, scenes, setScenes } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const handleAutoGroup = (): void => {
    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de texto disponivel.' })
      return
    }

    const grouped = autoGroupScenes(storyBlocks, blocksPerScene)
    setScenes(grouped)
    addToast({ type: 'success', message: `${grouped.length} cenas criadas.` })
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

      <div className="flex items-center gap-3">
        <label className="text-xs text-text-muted">Blocos por cena:</label>
        <input
          type="number"
          min={1}
          max={10}
          value={blocksPerScene}
          onChange={(e) => setBlocksPerScene(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm text-text focus:border-primary focus:outline-none"
        />
        <button
          onClick={handleAutoGroup}
          disabled={storyBlocks.length === 0}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
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
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
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
