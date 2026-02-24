import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Upload,
  Filter,
  CheckCircle2,
  FolderOpen,
  AlertTriangle,
  Magnet,
  Trash2
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
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

interface MediaImporterProps {
  onConfirm: () => void
}

export function MediaImporter({ onConfirm }: MediaImporterProps): React.JSX.Element {
  const scenes = useProjectStore((s) => s.scenes)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const { updateScene, bulkUpdateScenes } = useProjectStore()
  const { addToast } = useUIStore()

  const [showGapsOnly, setShowGapsOnly] = useState(false)
  const [isMatching, setIsMatching] = useState(false)
  const [modalData, setModalData] = useState<{
    matches: MatchResult[]
    unmatchedFiles: string[]
    unmatchedScenes: Array<{ id: string; index: number }>
  } | null>(null)

  const gapReport = useMemo(() => detectGaps(scenes), [scenes])
  const displayedScenes = showGapsOnly ? scenes.filter((s) => !s.mediaPath) : scenes
  const scenesWithMedia = scenes.filter((s) => s.mediaPath)

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
    const matchedIds = new Set(matches.map((m) => m.scene_id))

    const updates = scenes.map((s) => ({
      id: s.id,
      updates: matchedIds.has(s.id)
        ? {
            mediaPath: matches.find((m) => m.scene_id === s.id)!.media_path,
            generationStatus: 'imported' as const
          }
        : {
            mediaPath: null as string | null,
            generationStatus: 'pending' as const
          }
    }))

    bulkUpdateScenes(updates)
    setModalData(null)
    addToast({
      type: 'success',
      message: `${matches.length} midias associadas as cenas.`
    })
  }

  const handleClearMedia = (): void => {
    const updates = scenes
      .filter((s) => s.mediaPath)
      .map((s) => ({
        id: s.id,
        updates: { mediaPath: null as string | null, generationStatus: 'pending' as const }
      }))
    if (updates.length === 0) return
    bulkUpdateScenes(updates)
    addToast({ type: 'info', message: 'Midias removidas das cenas.' })
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

  return (
    <div className="flex flex-col gap-4">
      {/* Header with title + actions */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">Importacao de Midias</h3>
          <p className="text-xs text-text-muted mt-1">
            Associe arquivos de midia as cenas do projeto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleFolderImport}
            disabled={isMatching || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {isMatching ? 'Processando...' : 'Importar pasta'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImport}
            disabled={isMatching || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-bg px-4 py-1.5 text-xs font-medium text-text-muted transition-all duration-150 hover:text-text hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            Selecionar arquivos
          </motion.button>
        </div>
      </div>

      {/* Filter + clear row */}
      <div className="flex items-center gap-2">
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
        {scenesWithMedia.length > 0 && (
          <button
            onClick={handleClearMedia}
            className="flex items-center gap-1 rounded-md border border-error/20 bg-error/5 px-2.5 py-1.5 text-xs text-error transition-colors hover:bg-error/10"
          >
            <Trash2 className="h-3 w-3" />
            Limpar midias
          </button>
        )}
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

      {/* Confirm button */}
      <div className="flex justify-end pt-2 border-t border-border">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onConfirm}
          disabled={scenesWithMedia.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirmar
        </motion.button>
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
