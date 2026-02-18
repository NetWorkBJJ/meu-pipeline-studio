import { useState } from 'react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { autoSyncBlocks } from '@/lib/syncEngine'
import { SyncPreview } from './SyncPreview'

type Stage3View = 'action' | 'preview'

export function Stage3Sync(): React.JSX.Element {
  const [view, setView] = useState<Stage3View>('action')
  const [linkedCount, setLinkedCount] = useState(0)
  const [unlinkedCount, setUnlinkedCount] = useState(0)
  const { storyBlocks, audioBlocks, setStoryBlocks, capCutDraftPath } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const handleSync = (): void => {
    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de texto para sincronizar.' })
      return
    }
    if (audioBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de audio para sincronizar.' })
      return
    }

    const result = autoSyncBlocks(storyBlocks, audioBlocks)
    setStoryBlocks(result.syncedBlocks)
    setLinkedCount(result.linkedCount)
    setUnlinkedCount(result.unlinkedCount)

    addToast({ type: 'success', message: `${result.linkedCount} blocos sincronizados.` })
    setView('preview')
  }

  const handleConfirm = async (): Promise<void> => {
    if (capCutDraftPath) {
      try {
        const { storyBlocks: currentBlocks } = useProjectStore.getState()
        const timingBlocks = currentBlocks
          .filter((b) => b.linkedAudioId)
          .map((b) => ({
            material_id: b.linkedAudioId,
            start_ms: b.startMs,
            end_ms: b.endMs,
          }))

        await window.api.updateSubtitleTimings(capCutDraftPath, timingBlocks)
        await window.api.syncMetadata(capCutDraftPath)
      } catch {
        addToast({ type: 'warning', message: 'Timings salvos localmente (erro ao gravar no CapCut).' })
      }
    }

    completeStage(3)
    addToast({ type: 'success', message: 'Etapa 3 concluida. Avance para Direcao.' })
  }

  const handleBack = (): void => {
    setView('action')
  }

  if (view === 'preview') {
    return (
      <SyncPreview
        blocks={storyBlocks}
        linkedCount={linkedCount}
        unlinkedCount={unlinkedCount}
        onConfirm={handleConfirm}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text">Sincronizar legendas com audio</h3>
        <p className="text-xs text-text-muted mt-1">
          Vincula cada bloco de texto ao bloco de audio correspondente, ajustando os tempos automaticamente.
        </p>
      </div>
      <div className="flex gap-4">
        <div className="flex-1 rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Blocos de texto</p>
          <p className="text-2xl font-semibold text-text mt-1">{storyBlocks.length}</p>
        </div>
        <div className="flex-1 rounded-md border border-border bg-surface p-4">
          <p className="text-xs text-text-muted">Blocos de audio</p>
          <p className="text-2xl font-semibold text-text mt-1">{audioBlocks.length}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSync}
          disabled={storyBlocks.length === 0 || audioBlocks.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sincronizar automaticamente
        </button>
      </div>
    </div>
  )
}
