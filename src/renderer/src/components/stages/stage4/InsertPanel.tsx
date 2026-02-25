import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { detectGaps } from '@/lib/scenePlanner'

type InsertStatus = 'idle' | 'inserting' | 'done' | 'error'

interface InsertLog {
  step: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

interface AnalysisTrackInfo {
  index: number
  type: string
  segments: number
  duration_ms: number
  name: string
}

interface InsertPanelProps {
  onRetry?: () => void
}

export function InsertPanel({ onRetry }: InsertPanelProps): React.JSX.Element {
  const [status, setStatus] = useState<InsertStatus>('idle')
  const [logs, setLogs] = useState<InsertLog[]>([])
  const [existingTracks, setExistingTracks] = useState<AnalysisTrackInfo[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const scenes = useProjectStore((s) => s.scenes)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const trackOverview = useProjectStore((s) => s.trackOverview)
  const { updateStoryBlock } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const gapReport = useMemo(() => detectGaps(scenes), [scenes])
  const hasGaps = gapReport.missingScenes.length > 0

  const textCount =
    existingTracks.length > 0
      ? existingTracks.filter((t) => t.type === 'text').reduce((sum, t) => sum + t.segments, 0)
      : trackOverview.filter((t) => t.type === 'text').reduce((sum, t) => sum + t.segmentCount, 0)
  const videoCount =
    existingTracks.length > 0
      ? existingTracks.filter((t) => t.type === 'video').reduce((sum, t) => sum + t.segments, 0)
      : trackOverview
          .filter((t) => t.type === 'video')
          .reduce((sum, t) => sum + t.segmentCount, 0)
  const hasExistingContent = textCount > 0 || videoCount > 0

  useEffect(() => {
    if (capCutDraftPath && trackOverview.length === 0) {
      analyzeExisting()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capCutDraftPath, trackOverview.length])

  const analyzeExisting = async (): Promise<void> => {
    if (!capCutDraftPath) return
    setIsAnalyzing(true)
    try {
      const result = (await window.api.analyzeProject(capCutDraftPath)) as {
        tracks: AnalysisTrackInfo[]
      }
      setExistingTracks(result.tracks)
    } catch {
      setExistingTracks([])
    } finally {
      setIsAnalyzing(false)
    }
  }

  const addLog = (step: string, logStatus: InsertLog['status'], detail?: string): void => {
    setLogs((prev) => {
      const existing = prev.findIndex((l) => l.step === step)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { step, status: logStatus, detail }
        return updated
      }
      return [...prev, { step, status: logStatus, detail }]
    })
  }

  const handleClearAndInsert = async (): Promise<void> => {
    if (!capCutDraftPath) return

    setStatus('inserting')
    setLogs([])

    try {
      addLog('Criando backup...', 'running')
      await window.api.createBackup(capCutDraftPath)
      addLog('Criando backup...', 'done', 'Backup salvo')

      if (hasExistingContent) {
        if (textCount > 0) {
          addLog('Limpando legendas anteriores...', 'running')
          const clearResult = (await window.api.clearTextSegments(capCutDraftPath)) as {
            removed_segments: number
          }
          addLog(
            'Limpando legendas anteriores...',
            'done',
            `${clearResult.removed_segments} removidas`
          )
        }
        if (videoCount > 0) {
          addLog('Limpando midias anteriores...', 'running')
          const clearResult = (await window.api.clearVideoSegments(capCutDraftPath)) as {
            removed_segments: number
          }
          addLog(
            'Limpando midias anteriores...',
            'done',
            `${clearResult.removed_segments} removidas`
          )
        }
      }

      addLog('Escrevendo legendas...', 'running')
      const textBlocks = storyBlocks.map((b) => ({
        text: b.text,
        start_ms: b.startMs,
        end_ms: b.endMs
      }))
      const textResult = (await window.api.writeTextSegments(capCutDraftPath, textBlocks)) as {
        added_count: number
        segments: Array<{ segment_id: string; material_id: string; text: string }>
      }
      addLog('Escrevendo legendas...', 'done', `${textResult.added_count} legendas`)

      if (textResult.segments) {
        for (let i = 0; i < textResult.segments.length && i < storyBlocks.length; i++) {
          const seg = textResult.segments[i]
          updateStoryBlock(storyBlocks[i].id, {
            textMaterialId: seg.material_id,
            textSegmentId: seg.segment_id
          })
        }
      }

      const scenesWithMedia = scenes.filter((s) => s.mediaPath)
      if (scenesWithMedia.length > 0) {
        addLog('Escrevendo midias...', 'running')
        const videoScenes = scenesWithMedia.map((s) => ({
          media_path: s.mediaPath,
          start_ms: s.startMs,
          end_ms: s.endMs,
          media_type: s.mediaType
        }))
        const videoResult = (await window.api.writeVideoSegments(
          capCutDraftPath,
          videoScenes
        )) as { added_count: number }
        addLog('Escrevendo midias...', 'done', `${videoResult.added_count} midias`)
      }

      addLog('Sincronizando metadata...', 'running')
      await window.api.syncMetadata(capCutDraftPath)
      addLog('Sincronizando metadata...', 'done')

      setStatus('done')
      completeStage(4)
      addToast({ type: 'success', message: 'Insercao concluida! Abra o projeto no CapCut.' })

      try {
        await useProjectStore.getState().loadFullProject(capCutDraftPath)
      } catch {
        await analyzeExisting()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      addLog('Erro', 'error', message)
      setStatus('error')
      addToast({ type: 'error', message: 'Erro durante a insercao.' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-text">Insercao no CapCut</h3>
        <p className="text-xs text-text-muted mt-1">
          Escreve legendas e midias no projeto CapCut. Backup automatico antes de cada insercao.
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 shadow-surface">
          <p className="text-[11px] font-medium text-text-muted">Legendas</p>
          <p className="text-[28px] font-bold tabular-nums text-text mt-1.5">
            {storyBlocks.length}
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 shadow-surface">
          <p className="text-[11px] font-medium text-text-muted">Midias</p>
          <p className="text-[28px] font-bold tabular-nums text-text mt-1.5">
            {scenes.filter((s) => s.mediaPath).length}
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-border bg-surface p-4 shadow-surface">
          <p className="text-[11px] font-medium text-text-muted">Projeto</p>
          <p className="mt-1.5 truncate font-mono text-xs text-text-muted">
            {capCutDraftPath || 'Nao selecionado'}
          </p>
        </div>
      </div>

      {hasExistingContent && status !== 'inserting' && status !== 'done' && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div className="text-xs text-warning">
            <p className="font-semibold">Conteudo existente detectado na timeline:</p>
            <p className="mt-1">
              {textCount > 0 && `${textCount} legendas`}
              {textCount > 0 && videoCount > 0 && ' + '}
              {videoCount > 0 && `${videoCount} midias`}
            </p>
            <p className="mt-1 text-warning/70">
              O conteudo anterior sera removido automaticamente antes da nova insercao.
            </p>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analisando projeto...
        </div>
      )}

      {logs.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-input p-3 space-y-2 font-mono">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs ${log.status === 'pending' ? 'opacity-40' : ''}`}
            >
              {log.status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : log.status === 'running' ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 text-primary animate-spin" />
              ) : log.status === 'error' ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-error" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-border" />
              )}
              <span className="text-text">{log.step}</span>
              {log.detail && <span className="text-text-muted">{log.detail}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {status === 'done' && (
          <>
            <span className="flex items-center gap-1.5 self-center text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Concluido com backup!
            </span>
            <button
              onClick={async () => {
                const result = await window.api.openCapCut()
                if (!result.success) {
                  addToast({ type: 'error', message: result.error || 'Erro ao abrir CapCut.' })
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-border"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir no CapCut
            </button>
          </>
        )}
        <button
          onClick={handleClearAndInsert}
          disabled={status === 'inserting' || !capCutDraftPath}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'inserting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Inserindo...
            </>
          ) : hasExistingContent ? (
            <>
              <Trash2 className="h-4 w-4" />
              Limpar e inserir
            </>
          ) : (
            'Inserir no CapCut'
          )}
        </button>
      </div>

      {/* Success: no gaps */}
      {status === 'done' && !hasGaps && (
        <>
          <div className="border-t border-border" />
          <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-success">Pipeline concluido!</p>
              <p className="text-xs text-text-muted mt-0.5">
                {storyBlocks.length} legendas + {scenes.filter((s) => s.mediaPath).length} midias
                inseridas no CapCut. Abra o projeto para verificar.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Success with gaps: point to Retry step */}
      {status === 'done' && hasGaps && (
        <>
          <div className="border-t border-border" />
          <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning">
                {gapReport.missingScenes.length} cenas sem midia
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Cobertura: {gapReport.coveragePercent}%. Avance para o Retry para preencher os gaps.
              </p>
            </div>
            {onRetry && (
              <button
                onClick={() => {
                  setStatus('idle')
                  setLogs([])
                  onRetry()
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
