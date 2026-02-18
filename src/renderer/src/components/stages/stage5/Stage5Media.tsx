import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { msToDisplay } from '@/lib/time'

export function Stage5Media(): React.JSX.Element {
  const { scenes, setScenes } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const handleSelectMedia = async (sceneId: string): Promise<void> => {
    try {
      const files = await window.api.selectFiles([
        { name: 'Midia', extensions: ['mp4', 'mov', 'avi', 'jpg', 'jpeg', 'png', 'webp'] }
      ])
      if (files.length === 0) return

      const updated = scenes.map((s) => (s.id === sceneId ? { ...s, mediaPath: files[0] } : s))
      setScenes(updated)
      addToast({ type: 'success', message: 'Midia selecionada.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao selecionar midia.' })
    }
  }

  const assignedCount = scenes.filter((s) => s.mediaPath).length
  const allAssigned = scenes.length > 0 && assignedCount === scenes.length

  const handleConfirm = (): void => {
    if (!allAssigned) {
      addToast({ type: 'warning', message: 'Atribua midia a todas as cenas antes de confirmar.' })
      return
    }
    completeStage(5)
    addToast({ type: 'success', message: 'Etapa 5 concluida. Avance para Insercao.' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">Selecao de Midias</h3>
          <p className="text-xs text-text-muted mt-1">
            Atribua um arquivo de midia (video ou foto) para cada cena.
          </p>
        </div>
        {scenes.length > 0 && (
          <button
            onClick={handleConfirm}
            disabled={!allAssigned}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar midias
          </button>
        )}
      </div>

      <div className="text-xs text-text-muted">
        {assignedCount} / {scenes.length} cenas com midia
      </div>

      <div className="space-y-2 overflow-auto max-h-[calc(100vh-280px)]">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="flex items-center gap-3 rounded-md border border-border bg-surface p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
              {scene.index}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>
                  {msToDisplay(scene.startMs)} - {msToDisplay(scene.endMs)}
                </span>
                <span className="rounded bg-bg px-1.5 py-0.5">{scene.mediaType}</span>
                {scene.mediaKeyword && <span className="text-primary">{scene.mediaKeyword}</span>}
              </div>
              {scene.mediaPath ? (
                <p className="mt-0.5 truncate text-xs text-success">{scene.mediaPath}</p>
              ) : (
                <p className="mt-0.5 text-xs text-text-muted/50">Sem midia</p>
              )}
            </div>
            <button
              onClick={() => handleSelectMedia(scene.id)}
              className="shrink-0 rounded border border-border px-3 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              {scene.mediaPath ? 'Trocar' : 'Selecionar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
