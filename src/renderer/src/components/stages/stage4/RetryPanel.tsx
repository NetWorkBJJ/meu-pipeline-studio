import { useState, useMemo, useRef, useEffect } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Film,
  FolderOpen,
  Image,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { detectGaps } from '@/lib/scenePlanner'
import { GapIndicator } from './GapIndicator'
import { MatchReviewModal } from './MatchReviewModal'

interface MatchResult {
  scene_id: string
  scene_index: number
  media_path: string
  confidence: number
  match_reason: string
}

type MatchApiResult = {
  matches: MatchResult[]
  unmatched_files: string[]
  unmatched_scenes: Array<{ id: string; index: number }>
}

interface InsertLog {
  step: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

export function RetryPanel(): React.JSX.Element {
  const scenes = useProjectStore((s) => s.scenes)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const { bulkUpdateScenes } = useProjectStore()
  const { addToast } = useUIStore()

  const gapReport = useMemo(() => detectGaps(scenes), [scenes])
  const missingVideos = gapReport.missingScenes.filter((s) => s.mediaType === 'video')
  const missingImages = gapReport.missingScenes.filter((s) => s.mediaType === 'photo')
  const hasGaps = gapReport.missingScenes.length > 0

  // Track initial gap IDs for stable display list
  const initialGapIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (initialGapIds.current.size === 0) {
      const gaps = scenes.filter((s) => !s.mediaPath)
      initialGapIds.current = new Set(gaps.map((s) => s.id))
    }
  }, [scenes])

  // Track already-inserted scene IDs to prevent duplicates
  const insertedIds = useRef<Set<string>>(new Set())

  // Copy state
  const [copiedVideos, setCopiedVideos] = useState(false)
  const [copiedPhotos, setCopiedPhotos] = useState(false)

  // Prompt list expand
  const [showPromptList, setShowPromptList] = useState(false)

  // Import state
  const [isMatching, setIsMatching] = useState(false)
  const [modalData, setModalData] = useState<{
    matches: MatchResult[]
    unmatchedFiles: string[]
    unmatchedScenes: Array<{ id: string; index: number }>
  } | null>(null)

  // Insert state
  const [insertStatus, setInsertStatus] = useState<'idle' | 'inserting' | 'done' | 'error'>('idle')
  const [logs, setLogs] = useState<InsertLog[]>([])

  // Scenes that were gaps but now have media (and haven't been inserted yet)
  const newlyMatchedScenes = scenes.filter(
    (s) => initialGapIds.current.has(s.id) && s.mediaPath && !insertedIds.current.has(s.id)
  )

  // Display list: all scenes that were gaps when step loaded
  const displayScenes = scenes.filter((s) => initialGapIds.current.has(s.id))

  // --- Copy handlers ---

  const handleCopyGapVideos = async (): Promise<void> => {
    const text = missingVideos
      .filter((s) => s.prompt.trim())
      .map((s) => s.prompt)
      .join('\n\n')
    if (!text) {
      addToast({ type: 'warning', message: 'Nenhum prompt de video disponivel.' })
      return
    }
    await navigator.clipboard.writeText(text)
    setCopiedVideos(true)
    setTimeout(() => setCopiedVideos(false), 1500)
  }

  const handleCopyGapPhotos = async (): Promise<void> => {
    const text = missingImages
      .filter((s) => s.prompt.trim())
      .map((s) => s.prompt)
      .join('\n\n')
    if (!text) {
      addToast({ type: 'warning', message: 'Nenhum prompt de imagem disponivel.' })
      return
    }
    await navigator.clipboard.writeText(text)
    setCopiedPhotos(true)
    setTimeout(() => setCopiedPhotos(false), 1500)
  }

  // --- Import handlers ---

  const buildGapSceneData = (): Array<{
    id: string
    index: number
    filename_hint: string
    media_type: string
  }> =>
    gapReport.missingScenes.map((s) => ({
      id: s.id,
      index: s.index,
      filename_hint: s.filenameHint,
      media_type: s.mediaType
    }))

  const runMatching = async (filePaths: string[]): Promise<void> => {
    setIsMatching(true)
    try {
      const result = (await window.api.directorMatchMediaFiles({
        media_files: filePaths,
        scenes: buildGapSceneData(),
        strategy: 'auto'
      })) as MatchApiResult

      setModalData({
        matches: result.matches,
        unmatchedFiles: result.unmatched_files,
        unmatchedScenes: result.unmatched_scenes
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar midias'
      addToast({ type: 'error', message })
    } finally {
      setIsMatching(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    try {
      const filePaths = await window.api.directorSelectMediaFiles()
      if (filePaths.length === 0) return
      await runMatching(filePaths)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao importar midias'
      addToast({ type: 'error', message })
    }
  }

  const handleFolderImport = async (): Promise<void> => {
    try {
      const result = await window.api.directorSelectMediaFolder()
      if (!result.directory || result.files.length === 0) return
      addToast({
        type: 'info',
        message: `${result.total} midias encontradas na pasta. Associando...`
      })
      await runMatching(result.files)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao importar pasta'
      addToast({ type: 'error', message })
    }
  }

  const handleConfirmMatches = (matches: MatchResult[]): void => {
    // Only update matched gap scenes - never reset already-covered scenes
    const updates = matches.map((m) => ({
      id: m.scene_id,
      updates: {
        mediaPath: m.media_path,
        generationStatus: 'imported' as const
      }
    }))
    bulkUpdateScenes(updates)
    setModalData(null)
    addToast({ type: 'success', message: `${matches.length} midias associadas.` })
  }

  // --- Insert handler (additive, no clear) ---

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

  const handleRetryInsert = async (): Promise<void> => {
    if (!capCutDraftPath || newlyMatchedScenes.length === 0) return

    setInsertStatus('inserting')
    setLogs([])

    try {
      addLog('Criando backup...', 'running')
      await window.api.createBackup(capCutDraftPath)
      addLog('Criando backup...', 'done', 'Backup salvo')

      addLog('Escrevendo midias dos gaps...', 'running')
      const videoScenes = newlyMatchedScenes.map((s) => ({
        media_path: s.mediaPath,
        start_ms: s.startMs,
        end_ms: s.endMs,
        media_type: s.mediaType
      }))
      const result = (await window.api.writeVideoSegments(capCutDraftPath, videoScenes)) as {
        added_count: number
      }
      addLog('Escrevendo midias dos gaps...', 'done', `${result.added_count} midias`)

      addLog('Sincronizando metadata...', 'running')
      await window.api.syncMetadata(capCutDraftPath)
      addLog('Sincronizando metadata...', 'done')

      // Mark these scenes as inserted
      for (const s of newlyMatchedScenes) {
        insertedIds.current.add(s.id)
      }

      setInsertStatus('done')
      addToast({ type: 'success', message: `${result.added_count} midias inseridas nos gaps.` })

      try {
        await useProjectStore.getState().loadFullProject(capCutDraftPath)
      } catch {
        /* ignore reload errors */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      addLog('Erro', 'error', message)
      setInsertStatus('error')
      addToast({ type: 'error', message: 'Erro na insercao dos gaps.' })
    }
  }

  const handleReset = (): void => {
    setInsertStatus('idle')
    setLogs([])
    initialGapIds.current = new Set(scenes.filter((s) => !s.mediaPath).map((s) => s.id))
  }

  // --- No gaps: success state ---
  if (!hasGaps && initialGapIds.current.size === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-text">Retry - Preencher Gaps</h3>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-semibold text-success">Pipeline completo!</p>
            <p className="text-xs text-text-muted mt-0.5">
              Todas as {scenes.length} cenas possuem midia. Cobertura 100%.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Count gap scenes that have prompts
  const gapsWithPrompts = gapReport.missingScenes.filter((s) => s.prompt.trim()).length
  const gapsWithoutPrompts = gapReport.missingScenes.length - gapsWithPrompts

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-text">Retry - Preencher Gaps</h3>
        <p className="text-xs text-text-muted mt-1">
          Copie os prompts, importe as midias geradas e insira no CapCut.
        </p>
      </div>

      {/* Gap summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface p-3 shadow-surface">
          <div className="flex items-center gap-1.5 mb-1">
            <Film className="h-3.5 w-3.5 text-teal-400" />
            <p className="text-[11px] font-medium text-text-muted">Videos faltando</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-text">{missingVideos.length}</p>
          {missingVideos.length > 0 && (
            <p className="text-[10px] text-text-muted truncate mt-0.5">
              Cenas: {missingVideos.map((s) => s.index).join(', ')}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 shadow-surface">
          <div className="flex items-center gap-1.5 mb-1">
            <Image className="h-3.5 w-3.5 text-violet-400" />
            <p className="text-[11px] font-medium text-text-muted">Imagens faltando</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-text">{missingImages.length}</p>
          {missingImages.length > 0 && (
            <p className="text-[10px] text-text-muted truncate mt-0.5">
              Cenas: {missingImages.map((s) => s.index).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Coverage bar */}
      <GapIndicator report={gapReport} />

      {/* Prompts section */}
      {hasGaps && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-text">Prompts das cenas faltantes</h4>
            {gapsWithoutPrompts > 0 && (
              <span className="text-[10px] text-warning">
                {gapsWithoutPrompts} cena{gapsWithoutPrompts !== 1 && 's'} sem prompt
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {missingVideos.length > 0 && (
              <button
                onClick={handleCopyGapVideos}
                className="flex items-center gap-1.5 rounded-md border border-teal-500/30 bg-teal-500/5 px-3 py-1.5 text-[11px] font-medium text-teal-400 transition-colors hover:bg-teal-500/10"
              >
                {copiedVideos ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copiar Videos ({missingVideos.filter((s) => s.prompt.trim()).length})
              </button>
            )}
            {missingImages.length > 0 && (
              <button
                onClick={handleCopyGapPhotos}
                className="flex items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-1.5 text-[11px] font-medium text-violet-400 transition-colors hover:bg-violet-500/10"
              >
                {copiedPhotos ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copiar Fotos ({missingImages.filter((s) => s.prompt.trim()).length})
              </button>
            )}
            <button
              onClick={() => setShowPromptList(!showPromptList)}
              className="ml-auto flex items-center gap-1 text-[11px] text-text-muted hover:text-text transition-colors"
            >
              {showPromptList ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Recolher
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Ver prompts
                </>
              )}
            </button>
          </div>

          {/* Expandable prompt list */}
          {showPromptList && (
            <div className="mt-3 max-h-64 overflow-auto space-y-2">
              {gapReport.missingScenes.map((scene) => (
                <div
                  key={scene.id}
                  className="rounded-md border border-border bg-bg p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-text-muted">#{scene.index}</span>
                    {scene.mediaType === 'video' ? (
                      <span className="rounded-sm bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-400">
                        Video
                      </span>
                    ) : (
                      <span className="rounded-sm bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                        Foto
                      </span>
                    )}
                    <span className="text-text-muted truncate">{scene.description}</span>
                  </div>
                  {scene.prompt.trim() ? (
                    <pre className="whitespace-pre-wrap text-[11px] text-text/80 font-mono leading-relaxed">
                      {scene.prompt}
                    </pre>
                  ) : (
                    <p className="text-[11px] text-warning/70 italic">Sem prompt gerado</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import section */}
      {hasGaps && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h4 className="text-sm font-semibold text-text mb-3">Importar midias para gaps</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFolderImport}
              disabled={isMatching}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isMatching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              Importar pasta
            </button>
            <button
              onClick={handleImport}
              disabled={isMatching}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-border disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload className="h-3.5 w-3.5" />
              Selecionar arquivos
            </button>
            <span className="ml-auto text-[11px] text-text-muted">
              Matching filtra apenas as {gapReport.missingScenes.length} cenas faltantes
            </span>
          </div>
        </div>
      )}

      {/* Gap scene list */}
      {displayScenes.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h4 className="text-sm font-semibold text-text mb-3">
            Cenas ({displayScenes.filter((s) => s.mediaPath).length}/{displayScenes.length}{' '}
            preenchidas)
          </h4>
          <div className="overflow-auto max-h-48 space-y-1">
            {displayScenes.map((scene) => (
              <div
                key={scene.id}
                className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2"
              >
                <span className="text-xs font-mono text-text-muted w-8">#{scene.index}</span>
                {scene.mediaType === 'video' ? (
                  <Film className="h-3 w-3 shrink-0 text-teal-400" />
                ) : (
                  <Image className="h-3 w-3 shrink-0 text-violet-400" />
                )}
                <span className="flex-1 text-xs text-text truncate">{scene.description}</span>
                {scene.mediaPath ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-muted truncate max-w-32">
                      {scene.mediaPath.split(/[/\\]/).pop()}
                    </span>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  </div>
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insert logs */}
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

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        {insertStatus === 'done' && (
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
        {insertStatus === 'done' && hasGaps && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-border"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-tentar
          </button>
        )}
        <button
          onClick={handleRetryInsert}
          disabled={insertStatus === 'inserting' || !capCutDraftPath || newlyMatchedScenes.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {insertStatus === 'inserting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Inserindo...
            </>
          ) : (
            <>
              Inserir {newlyMatchedScenes.length} midia{newlyMatchedScenes.length !== 1 && 's'}
            </>
          )}
        </button>
      </div>

      {/* Post-insert: all gaps filled */}
      {insertStatus === 'done' && !hasGaps && (
        <>
          <div className="border-t border-border" />
          <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-success">Pipeline completo!</p>
              <p className="text-xs text-text-muted mt-0.5">
                Todas as cenas possuem midia. Cobertura 100%.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Match review modal */}
      <MatchReviewModal
        isOpen={modalData !== null}
        onClose={() => setModalData(null)}
        onConfirm={handleConfirmMatches}
        matches={modalData?.matches ?? []}
        unmatchedFiles={modalData?.unmatchedFiles ?? []}
        unmatchedScenes={modalData?.unmatchedScenes ?? []}
      />
    </div>
  )
}
