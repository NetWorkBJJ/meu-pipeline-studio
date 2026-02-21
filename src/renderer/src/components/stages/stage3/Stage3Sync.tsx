import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Music,
  Type,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Circle
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { autoSyncBlocks, analyzeAudioState } from '@/lib/syncEngine'
import type { AudioAnalysis } from '@/lib/syncEngine'
import { msToDisplay } from '@/lib/time'
import { SyncPreview } from './SyncPreview'

type SyncPhase = 'summary' | 'processing' | 'result'

interface ProcessingStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done'
}

export function Stage3Sync(): React.JSX.Element {
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const audioBlocks = useProjectStore((s) => s.audioBlocks)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const { setStoryBlocks, reloadAudioBlocks } = useProjectStore()
  const { completeStage } = useStageStore()
  const completedStages = useStageStore((s) => s.completedStages)
  const { addToast } = useUIStore()

  const [phase, setPhase] = useState<SyncPhase>('summary')
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null)
  const [steps, setSteps] = useState<ProcessingStep[]>([])
  const [linkedCount, setLinkedCount] = useState(0)
  const [unlinkedCount, setUnlinkedCount] = useState(0)
  const [gapsRemoved, setGapsRemoved] = useState(0)
  const [loading, setLoading] = useState(false)

  const hasExistingSync =
    projectLoaded &&
    storyBlocks.length > 0 &&
    audioBlocks.length > 0 &&
    storyBlocks.some((b) => b.textMaterialId)
  const stageAlreadyComplete = completedStages.has(3)

  const isCapCutAudio = audioBlocks.some((b) => b.source === 'capcut')
  const hasAudio = audioBlocks.length > 0
  const hasText = storyBlocks.length > 0

  // Auto-analyze on mount and when audio blocks change
  const runAnalysis = useCallback(async () => {
    if (!hasAudio) {
      setAnalysis(null)
      return
    }

    // If CapCut draft exists, refresh audio blocks from draft for accurate analysis
    if (capCutDraftPath && isCapCutAudio && phase === 'summary') {
      setLoading(true)
      try {
        await reloadAudioBlocks(capCutDraftPath)
      } catch {
        // If reload fails, use current store data
      } finally {
        setLoading(false)
      }
    }
  }, [capCutDraftPath, isCapCutAudio, hasAudio, phase, reloadAudioBlocks])

  useEffect(() => {
    if (phase === 'summary') {
      runAnalysis()
    }
  }, [phase, runAnalysis])

  // Recompute analysis when audioBlocks change
  useEffect(() => {
    if (hasAudio) {
      setAnalysis(analyzeAudioState(audioBlocks, storyBlocks.length))
    }
  }, [audioBlocks, storyBlocks.length, hasAudio])

  // --- Processing logic ---
  const updateStep = (stepId: string, status: ProcessingStep['status']): void => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)))
  }

  const handleSync = async (): Promise<void> => {
    // Build processing steps based on scenario
    const newSteps: ProcessingStep[] = []
    if (isCapCutAudio && capCutDraftPath) {
      newSteps.push(
        { id: 'consolidate', label: 'Consolidando audio em 1 track', status: 'pending' },
        { id: 'gaps', label: 'Removendo gaps entre segmentos', status: 'pending' }
      )
    }
    newSteps.push(
      { id: 'align', label: 'Alinhando legendas com audio', status: 'pending' },
      { id: 'finish', label: 'Finalizando', status: 'pending' }
    )

    setSteps(newSteps)
    setPhase('processing')

    try {
      let freshAudioBlocks = audioBlocks

      // Step 1+2: Consolidate audio in CapCut draft
      if (isCapCutAudio && capCutDraftPath) {
        updateStep('consolidate', 'running')
        const flattenResult = (await window.api.flattenAudio(capCutDraftPath)) as {
          success: boolean
          stats: { totalSegments: number; originalTracks: number; removedTracks: number }
        }
        updateStep('consolidate', 'done')

        await new Promise((r) => setTimeout(r, 400))

        updateStep('gaps', 'running')
        // Reload fresh audio blocks after consolidation
        await reloadAudioBlocks(capCutDraftPath)
        freshAudioBlocks = useProjectStore.getState().audioBlocks
        setGapsRemoved(flattenResult.stats?.removedTracks ?? 0)
        updateStep('gaps', 'done')

        await new Promise((r) => setTimeout(r, 400))
      }

      // Step 3: Align text to audio
      updateStep('align', 'running')
      await new Promise((r) => setTimeout(r, 300))

      const result = autoSyncBlocks(storyBlocks, freshAudioBlocks)
      setStoryBlocks(result.syncedBlocks)
      setLinkedCount(result.linkedCount)
      setUnlinkedCount(result.unlinkedCount)
      updateStep('align', 'done')

      await new Promise((r) => setTimeout(r, 400))

      // Step 4: Finalize
      updateStep('finish', 'running')
      await new Promise((r) => setTimeout(r, 300))

      // Compute actual gaps removed from analysis
      if (!isCapCutAudio && analysis) {
        setGapsRemoved(analysis.gapCount)
      }

      updateStep('finish', 'done')

      // Brief pause to show the last checkmark, then transition
      await new Promise((r) => setTimeout(r, 500))
      setPhase('result')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao sincronizar'
      addToast({ type: 'error', message })
      setPhase('summary')
    }
  }

  const handleAcceptExisting = (): void => {
    completeStage(3)
    addToast({ type: 'success', message: 'Sincronizacao existente aceita.' })
  }

  const handleConfirm = async (): Promise<void> => {
    // Write timings back to CapCut if blocks have material IDs
    const blocksWithIds = storyBlocks.filter((b) => b.textMaterialId)
    if (blocksWithIds.length > 0 && capCutDraftPath) {
      try {
        const timingBlocks = blocksWithIds.map((b) => ({
          material_id: b.textMaterialId,
          start_ms: b.startMs,
          end_ms: b.endMs
        }))
        await window.api.updateSubtitleTimings(capCutDraftPath, timingBlocks)
        await window.api.syncMetadata(capCutDraftPath)
      } catch {
        addToast({
          type: 'warning',
          message: 'Timings salvos localmente (erro ao gravar no CapCut).'
        })
      }
    }

    completeStage(3)
    addToast({ type: 'success', message: 'Etapa concluida. Avance para Direcao.' })
  }

  const handleRefresh = (): void => {
    setPhase('summary')
    setSteps([])
    setGapsRemoved(0)
  }

  // --- Render ---
  return (
    <AnimatePresence mode="wait">
      {phase === 'summary' && (
        <SummaryView
          key="summary"
          analysis={analysis}
          hasAudio={hasAudio}
          hasText={hasText}
          hasExistingSync={hasExistingSync}
          stageAlreadyComplete={stageAlreadyComplete}
          storyBlockCount={storyBlocks.length}
          audioBlockCount={audioBlocks.length}
          loading={loading}
          onSync={handleSync}
          onAccept={handleAcceptExisting}
        />
      )}
      {phase === 'processing' && <ProcessingView key="processing" steps={steps} />}
      {phase === 'result' && (
        <motion.div
          key="result"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          <SyncPreview
            blocks={storyBlocks}
            linkedCount={linkedCount}
            unlinkedCount={unlinkedCount}
            gapsRemoved={gapsRemoved}
            onConfirm={handleConfirm}
            onBack={handleRefresh}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Summary View ---

function SummaryView({
  analysis,
  hasAudio,
  hasText,
  hasExistingSync,
  stageAlreadyComplete,
  storyBlockCount,
  audioBlockCount,
  loading,
  onSync,
  onAccept
}: {
  analysis: AudioAnalysis | null
  hasAudio: boolean
  hasText: boolean
  hasExistingSync: boolean
  stageAlreadyComplete: boolean
  storyBlockCount: number
  audioBlockCount: number
  loading: boolean
  onSync: () => void
  onAccept: () => void
}): React.JSX.Element {
  const canSync = hasAudio && hasText && !loading

  // Build adaptive info message
  const getInfoMessage = (): { text: string; type: 'info' | 'warning' | 'success' } => {
    if (!hasAudio) {
      return { text: 'Nenhum audio detectado. Complete o Stage 2 primeiro.', type: 'warning' }
    }
    if (!hasText) {
      return { text: 'Nenhum texto para sincronizar. Complete o Stage 1 primeiro.', type: 'warning' }
    }
    if (hasExistingSync && !stageAlreadyComplete) {
      return {
        text: 'Projeto ja possui legendas sincronizadas com audio. Aceite ou re-sincronize.',
        type: 'success'
      }
    }

    if (!analysis) return { text: 'Analisando...', type: 'info' }

    const parts: string[] = []

    if (analysis.trackCount > 1) {
      parts.push(`Audio em ${analysis.trackCount} tracks`)
    }
    if (analysis.gapCount > 0) {
      parts.push(
        `${analysis.gapCount} gap${analysis.gapCount > 1 ? 's' : ''} (${msToDisplay(analysis.totalGapMs)})`
      )
    }

    if (parts.length > 0) {
      return {
        text: `${parts.join(' com ')}. Sera consolidado em 1 track sem gaps.`,
        type: 'info'
      }
    }

    if (analysis.mismatch !== 0) {
      const abs = Math.abs(analysis.mismatch)
      if (analysis.mismatch > 0) {
        return {
          text: `${storyBlockCount} legendas para ${audioBlockCount} audios. ${abs} legenda${abs > 1 ? 's' : ''} ficara${abs > 1 ? 'o' : ''} sem audio.`,
          type: 'warning'
        }
      }
      return {
        text: `${audioBlockCount} audios para ${storyBlockCount} legendas. ${abs} audio${abs > 1 ? 's' : ''} ficara${abs > 1 ? 'o' : ''} sem legenda.`,
        type: 'warning'
      }
    }

    return { text: 'Audio organizado em 1 track sem gaps. Pronto para alinhar.', type: 'success' }
  }

  const info = getInfoMessage()

  const infoBorderColor =
    info.type === 'warning'
      ? 'border-warning/30 bg-warning/5'
      : info.type === 'success'
        ? 'border-success/30 bg-success/5'
        : 'border-primary/30 bg-primary/5'

  const infoIconColor =
    info.type === 'warning'
      ? 'text-warning'
      : info.type === 'success'
        ? 'text-success'
        : 'text-primary'

  const InfoIcon = info.type === 'warning' ? AlertTriangle : info.type === 'success' ? CheckCircle2 : Music

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text">Sincronizacao</h3>
          {hasExistingSync && !stageAlreadyComplete && (
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">
              Ja sincronizado
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Alinha cada legenda ao audio correspondente na timeline.
        </p>
      </div>

      {/* Stat boxes */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Type className="h-3 w-3 text-text-muted" />
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Legendas
            </p>
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-text">{storyBlockCount}</p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Music className="h-3 w-3 text-text-muted" />
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Audios
            </p>
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-text">{audioBlockCount}</p>
        </div>
        {analysis && analysis.gapCount > 0 && (
          <div className="flex-1 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-warning/80">Gaps</p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-warning">
              {analysis.gapCount}
            </p>
          </div>
        )}
        {analysis && analysis.trackCount > 1 && (
          <div className="flex-1 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary/80">
              Tracks
            </p>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-primary-light">
              {analysis.trackCount}
            </p>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className={`flex items-start gap-3 rounded-lg border p-4 ${infoBorderColor}`}>
        <InfoIcon className={`mt-0.5 h-5 w-5 shrink-0 ${infoIconColor}`} />
        <p className="text-xs text-text-muted">{info.text}</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {hasExistingSync && !stageAlreadyComplete && (
          <button
            onClick={onAccept}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
          >
            Aceitar existente
          </button>
        )}
        <button
          onClick={onSync}
          disabled={!canSync}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
          {hasExistingSync && !stageAlreadyComplete ? 'Re-sincronizar' : 'Sincronizar'}
        </button>
      </div>
    </motion.div>
  )
}

// --- Processing View ---

function ProcessingView({ steps }: { steps: ProcessingStep[] }): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h3 className="text-sm font-medium text-text">Sincronizando...</h3>
        <p className="mt-1 text-xs text-text-muted">
          Organizando audio e alinhando legendas automaticamente.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.2 }}
            className="flex items-center gap-3"
          >
            {step.status === 'done' && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            )}
            {step.status === 'running' && (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            )}
            {step.status === 'pending' && (
              <Circle className="h-5 w-5 shrink-0 text-text-muted/30" />
            )}
            <span
              className={`text-sm ${
                step.status === 'done'
                  ? 'text-text'
                  : step.status === 'running'
                    ? 'text-primary-light'
                    : 'text-text-muted/50'
              }`}
            >
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
