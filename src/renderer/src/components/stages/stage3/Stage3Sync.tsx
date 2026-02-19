import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Wand2, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { autoSyncBlocks } from '@/lib/syncEngine'
import { SyncPreview } from './SyncPreview'

type Stage3View = 'action' | 'preview'

interface SyncStats {
  gapsRemoved: number
  mediaModified: number
  subtitlesModified: number
  animationsApplied?: number
}

export function Stage3Sync(): React.JSX.Element {
  const [view, setView] = useState<Stage3View>('action')
  const [linkedCount, setLinkedCount] = useState(0)
  const [unlinkedCount, setUnlinkedCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null)
  const [applyAnim, setApplyAnim] = useState(false)
  const [resyncingTimings, setResyncingTimings] = useState(false)
  const { storyBlocks, audioBlocks, setStoryBlocks, capCutDraftPath } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const handleLocalSync = (): void => {
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

  const handleCapCutSync = async (): Promise<void> => {
    if (!capCutDraftPath) {
      addToast({ type: 'error', message: 'Nenhum projeto CapCut selecionado.' })
      return
    }

    setSyncing(true)
    try {
      const result = (await window.api.syncProject({
        draftPath: capCutDraftPath,
        audioTrackIndex: 0,
        mode: 'audio',
        syncSubtitles: true,
        applyAnimations: applyAnim
      })) as { success: boolean; stats: SyncStats }

      setSyncStats(result.stats)

      // Also sync blocks locally for preview
      if (storyBlocks.length > 0 && audioBlocks.length > 0) {
        const localResult = autoSyncBlocks(storyBlocks, audioBlocks)
        setStoryBlocks(localResult.syncedBlocks)
        setLinkedCount(localResult.linkedCount)
        setUnlinkedCount(localResult.unlinkedCount)
      }

      addToast({
        type: 'success',
        message: `Sync CapCut: ${result.stats.gapsRemoved} gaps removidos, ${result.stats.mediaModified} midias sincronizadas.`
      })
      setView('preview')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar'
      addToast({ type: 'error', message })
    } finally {
      setSyncing(false)
    }
  }

  const hasCapCutIds = storyBlocks.some((b) => b.textMaterialId)

  const handleResyncTimings = async (): Promise<void> => {
    if (!capCutDraftPath) {
      addToast({ type: 'error', message: 'Nenhum projeto CapCut selecionado.' })
      return
    }

    const blocksWithIds = storyBlocks.filter((b) => b.textMaterialId)
    if (blocksWithIds.length === 0) {
      addToast({
        type: 'warning',
        message: 'Nenhum bloco com ID do CapCut. Insira as legendas primeiro (Stage 1 ou 6).'
      })
      return
    }

    setResyncingTimings(true)
    try {
      const timingBlocks = blocksWithIds.map((b) => ({
        material_id: b.textMaterialId,
        start_ms: b.startMs,
        end_ms: b.endMs
      }))

      const result = (await window.api.updateSubtitleTimings(capCutDraftPath, timingBlocks)) as {
        updated_count: number
      }

      await window.api.syncMetadata(capCutDraftPath)

      addToast({
        type: 'success',
        message: `${result.updated_count} timings atualizados no CapCut.`
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao re-sincronizar timings'
      addToast({ type: 'error', message })
    } finally {
      setResyncingTimings(false)
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (capCutDraftPath) {
      try {
        await window.api.syncMetadata(capCutDraftPath)
      } catch {
        addToast({
          type: 'warning',
          message: 'Timings salvos localmente (erro ao gravar metadata).'
        })
      }
    }

    completeStage(3)
    addToast({ type: 'success', message: 'Etapa 3 concluida. Avance para Direcao.' })
  }

  const handleBack = (): void => {
    setView('action')
    setSyncStats(null)
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
      >
        {view === 'preview' ? (
          <div className="flex flex-col gap-4">
            {syncStats && (
              <div className="flex gap-3 text-xs">
                <span className="rounded-md bg-success/10 px-2 py-1 text-success">
                  {syncStats.gapsRemoved} gaps removidos
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                  {syncStats.mediaModified} midias sync
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-primary">
                  {syncStats.subtitlesModified} legendas sync
                </span>
                {syncStats.animationsApplied !== undefined && syncStats.animationsApplied > 0 && (
                  <span className="rounded-md bg-violet-500/10 px-2 py-1 text-violet-400">
                    {syncStats.animationsApplied} animacoes
                  </span>
                )}
              </div>
            )}
            <SyncPreview
              blocks={storyBlocks}
              linkedCount={linkedCount}
              unlinkedCount={unlinkedCount}
              onConfirm={handleConfirm}
              onBack={handleBack}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-medium text-text">Sincronizar legendas com audio</h3>
              <p className="text-xs text-text-muted mt-1">
                Vincula cada bloco de texto ao bloco de audio correspondente, ajustando os tempos
                automaticamente. Remove gaps e sincroniza midias na timeline.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg border border-border bg-surface p-4 shadow-surface">
                <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Blocos de texto
                </p>
                <p className="text-2xl font-bold tabular-nums text-text mt-1.5">
                  {storyBlocks.length}
                </p>
              </div>
              <div className="flex-1 rounded-lg border border-border bg-surface p-4 shadow-surface">
                <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Blocos de audio
                </p>
                <p className="text-2xl font-bold tabular-nums text-text mt-1.5">
                  {audioBlocks.length}
                </p>
              </div>
            </div>

            {/* Animation toggle */}
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={applyAnim}
                onChange={(e) => setApplyAnim(e.target.checked)}
                className="rounded border-border"
              />
              <Sparkles className="h-3 w-3" />
              Aplicar animacoes Ken Burns em fotos
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleLocalSync}
                disabled={storyBlocks.length === 0 || audioBlocks.length === 0}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sync local
              </button>
              {hasCapCutIds && (
                <button
                  onClick={handleResyncTimings}
                  disabled={resyncingTimings || !capCutDraftPath}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {resyncingTimings ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {resyncingTimings ? 'Re-sincronizando...' : 'Re-sync timings'}
                </button>
              )}
              <button
                onClick={handleCapCutSync}
                disabled={syncing || !capCutDraftPath}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {syncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {syncing ? 'Sincronizando...' : 'Sync CapCut'}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
