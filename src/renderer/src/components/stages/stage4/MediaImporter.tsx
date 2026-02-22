import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Upload, Filter, CheckCircle2, FolderOpen } from 'lucide-react'
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

export function MediaImporter(): React.JSX.Element {
  const scenes = useProjectStore((s) => s.scenes)
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
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

  const gapReport = useMemo(() => detectGaps(scenes), [scenes])
  const displayedScenes = showGapsOnly ? scenes.filter((s) => !s.mediaPath) : scenes

  const handleImport = async (): Promise<void> => {
    try {
      const filePaths = await window.api.directorSelectMediaFiles()
      if (filePaths.length === 0) return

      setIsMatching(true)

      const sceneData = scenes.map((s) => ({
        id: s.id,
        index: s.index,
        filename_hint: s.filenameHint,
        media_type: s.mediaType
      }))

      const result = (await window.api.directorMatchMediaFiles({
        media_files: filePaths,
        scenes: sceneData,
        strategy: 'auto'
      })) as {
        matches: MatchResult[]
        unmatched_files: string[]
        unmatched_scenes: Array<{ id: string; index: number }>
      }

      setModalData({
        matches: result.matches,
        unmatchedFiles: result.unmatched_files,
        unmatchedScenes: result.unmatched_scenes
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao importar midias'
      addToast({ type: 'error', message })
    } finally {
      setIsMatching(false)
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

  const handleConfirmImport = (): void => {
    completeStage(4)
    addToast({
      type: 'success',
      message: `Etapa 4 concluida. ${gapReport.coveredScenes}/${gapReport.totalScenes} cenas com midia.`
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Import actions */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleImport}
            disabled={isMatching || scenes.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            {isMatching ? 'Processando...' : 'Importar midias'}
          </motion.button>
          <button
            onClick={() => setShowGapsOnly(!showGapsOnly)}
            className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              showGapsOnly
                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
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

      {/* Scene grid */}
      <div className="overflow-auto max-h-[calc(100vh-440px)] space-y-2">
        {displayedScenes.map((scene) => (
          <div key={scene.id} className="relative">
            <SceneCard
              scene={scene}
              blocks={storyBlocks}
              showMedia
              compact
            />
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

      {/* Confirm */}
      <div className="flex justify-end pt-2 border-t border-border">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConfirmImport}
          disabled={scenes.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirmar importacao
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
