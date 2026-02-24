import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Filter,
  CheckCircle2,
  FolderOpen,
  Loader2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Magnet
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { detectGaps } from '@/lib/scenePlanner'
import { SceneCard } from './SceneCard'
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

type InsertStatus = 'idle' | 'inserting' | 'done' | 'error'

interface InsertLog {
  step: string
  status: 'running' | 'done' | 'error'
  detail?: string
}

export function MediaImporter(): React.JSX.Element {
  const scenes = useProjectStore((s) => s.scenes)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const { updateScene, bulkUpdateScenes } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const [showGapsOnly, setShowGapsOnly] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [modalData, setModalData] = useState<{
    matches: MatchResult[]
    unmatchedFiles: string[]
    unmatchedScenes: Array<{ id: string; index: number }>
  } | null>(null)

  const [insertStatus, setInsertStatus] = useState<InsertStatus>('idle')
  const [insertLogs, setInsertLogs] = useState<InsertLog[]>([])

  const gapReport = useMemo(() => detectGaps(scenes), [scenes])
  const displayedScenes = showGapsOnly ? scenes.filter((s) => !s.mediaPath) : scenes
  const scenesWithMedia = scenes.filter((s) => s.mediaPath)
  const canInsert = scenesWithMedia.length > 0 && !!capCutDraftPath

  const addLog = (step: string, status: InsertLog['status'], detail?: string): void => {
    setInsertLogs((prev) => {
      const existing = prev.findIndex((l) => l.step === step)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { step, status, detail }
        return updated
      }
      return [...prev, { step, status, detail }]
    })
  }

  const buildSceneData = () =>
    scenes.map((s) => ({
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
        scenes: buildSceneData(),
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
    const updates = matches.map((m) => ({
      id: m.scene_id,
      updates: {
        mediaPath: m.media_path,
        generationStatus: 'imported' as const
      }
    }))

    bulkUpdateScenes(updates)
    setModalData(null)
    addToast({
      type: 'success',
      message: `${matches.length} midias associadas as cenas.`
    })
  }

  const handleSelectIndividual = async (sceneId: string): Promise<void> => {
    try {
      const filePaths = await window.api.directorSelectMediaFiles()
      if (filePaths.length > 0) {
        updateScene(sceneId, {
          mediaPath: filePaths[0],
          generationStatus: 'imported'
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao selecionar midia'
      addToast({ type: 'error', message })
    }
  }

  const handleInsertToTimeline = async (): Promise<void> => {
    if (!canInsert) return

    setInsertStatus('inserting')
    setInsertLogs([])

    try {
      // 1. Backup
      addLog('Criando backup...', 'running')
      await window.api.createBackup(capCutDraftPath!)
      addLog('Criando backup...', 'done', 'Backup salvo')

      // 2. Clear existing video segments
      addLog('Limpando midias anteriores...', 'running')
      const clearResult = (await window.api.clearVideoSegments(capCutDraftPath!)) as {
        removed_segments: number
      }
      addLog(
        'Limpando midias anteriores...',
        'done',
        clearResult.removed_segments > 0
          ? `${clearResult.removed_segments} removidas`
          : 'Nenhuma anterior'
      )

      // 3. Write video segments with Director timing (sorted by timeline position)
      addLog(`Inserindo ${scenesWithMedia.length} midias...`, 'running')
      const videoScenes = [...scenesWithMedia]
        .sort((a, b) => a.startMs - b.startMs)
        .map((s) => ({
          media_path: s.mediaPath,
          start_ms: s.startMs,
          end_ms: s.endMs,
          media_type: s.mediaType
        }))
      const writeResult = (await window.api.writeVideoSegments(
        capCutDraftPath!,
        videoScenes
      )) as { added_count: number }
      addLog(
        `Inserindo ${scenesWithMedia.length} midias...`,
        'done',
        `${writeResult.added_count} inseridas`
      )

      // 4. Sync metadata
      addLog('Sincronizando metadata...', 'running')
      await window.api.syncMetadata(capCutDraftPath!)
      addLog('Sincronizando metadata...', 'done')

      setInsertStatus('done')
      completeStage(4)
      completeStage(5)
      addToast({
        type: 'success',
        message: `${writeResult.added_count} midias inseridas na timeline do CapCut.`
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao inserir na timeline'
      addLog('Erro', 'error', message)
      setInsertStatus('error')
      addToast({ type: 'error', message: 'Erro durante a insercao na timeline.' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Import actions */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleFolderImport}
            disabled={isMatching || scenes.length === 0 || insertStatus === 'inserting'}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {isMatching ? 'Processando...' : 'Importar pasta'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImport}
            disabled={isMatching || scenes.length === 0 || insertStatus === 'inserting'}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-1.5 text-xs font-medium text-text-muted transition-all duration-150 hover:text-text hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            Selecionar arquivos
          </motion.button>
          <button
            onClick={() => setShowGapsOnly(!showGapsOnly)}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              showGapsOnly
                ? 'border-warning/30 bg-warning/10 text-warning'
                : 'border-border bg-bg text-text-muted hover:text-text'
            }`}
          >
            <Filter className="h-3 w-3" />
            {showGapsOnly ? 'Mostrando gaps' : 'Filtrar gaps'}
          </button>
        </div>
      </div>

      {/* Gap indicator */}
      <GapIndicator report={gapReport} />

      {/* Gap / magnet warning */}
      {scenesWithMedia.length > 0 && scenesWithMedia.length < scenes.length && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Magnet className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <p className="text-xs text-text-muted">
            {scenes.length - scenesWithMedia.length} cenas sem midia - gaps serao preservados no
            timeline. O ima (<kbd className="rounded bg-surface px-1 py-0.5 text-[10px] font-mono text-text">P</kbd>) sera desativado automaticamente no CapCut.
          </p>
        </div>
      )}

      {/* No draft warning */}
      {!capCutDraftPath && scenesWithMedia.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <p className="text-xs text-warning">
            Nenhum projeto CapCut selecionado. Selecione um draft na Etapa 2 para inserir midias na
            timeline.
          </p>
        </div>
      )}

      {/* Insert progress logs */}
      {insertLogs.length > 0 && (
        <div className="rounded-lg border border-border bg-bg p-3 space-y-2 font-mono">
          {insertLogs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {log.status === 'done' ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
              ) : log.status === 'running' ? (
                <Loader2 className="h-3 w-3 shrink-0 text-primary animate-spin" />
              ) : (
                <AlertTriangle className="h-3 w-3 shrink-0 text-error" />
              )}
              <span className="text-text">{log.step}</span>
              {log.detail && <span className="text-text-muted">{log.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Scene grid */}
      <div className="overflow-auto max-h-[calc(100vh-500px)] space-y-2">
        {displayedScenes.map((scene) => (
          <div key={scene.id} className="relative">
            <SceneCard scene={scene} blocks={storyBlocks} showMedia compact />
            {!scene.mediaPath && (
              <button
                onClick={() => handleSelectIndividual(scene.id)}
                className="absolute top-2 right-2 flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-text hover:border-primary/30"
              >
                <FolderOpen className="h-2.5 w-2.5" />
                Selecionar
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          {insertStatus === 'done' && (
            <>
              <span className="flex items-center gap-1.5 text-xs text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                Inserido com backup!
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
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleInsertToTimeline}
            disabled={!canInsert || insertStatus === 'inserting'}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {insertStatus === 'inserting' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Inserindo...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Inserir na timeline
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Match review modal */}
      {modalData && (
        <MatchReviewModal
          isOpen={!!modalData}
          onClose={() => setModalData(null)}
          onConfirm={handleConfirmMatches}
          matches={modalData.matches}
          unmatchedFiles={modalData.unmatchedFiles}
          unmatchedScenes={modalData.unmatchedScenes}
        />
      )}
    </div>
  )
}
