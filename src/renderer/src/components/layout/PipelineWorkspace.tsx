import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { TopBar } from './TopBar'
import { StageProgress } from './StageProgress'
import { TimelinePanel } from '../timeline/TimelinePanel'
import { StatusBar } from './StatusBar'
import { useStageStore } from '@/stores/useStageStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { Stage1Script } from '../stages/stage1/Stage1Script'
import { Stage2Audio } from '../stages/stage2/Stage2Audio'
import { Stage3Sync } from '../stages/stage3/Stage3Sync'
import { Stage4Director } from '../stages/stage4/Stage4Director'
import { Stage5Media } from '../stages/stage5/Stage5Media'
import { Stage6Insert } from '../stages/stage6/Stage6Insert'

function StageContent(): React.JSX.Element {
  const { currentStage } = useStageStore()

  switch (currentStage) {
    case 1:
      return <Stage1Script />
    case 2:
      return <Stage2Audio />
    case 3:
      return <Stage3Sync />
    case 4:
      return <Stage4Director />
    case 5:
      return <Stage5Media />
    case 6:
      return <Stage6Insert />
    default:
      return <Stage1Script />
  }
}

export function PipelineWorkspace(): React.JSX.Element {
  const { currentStage } = useStageStore()
  const { capCutDraftPath } = useProjectStore()
  const { setCurrentView, externalChange, setExternalChange } = useUIStore()

  // Start/stop file watcher when draft path changes
  useEffect(() => {
    if (!capCutDraftPath) {
      setCurrentView('projectDashboard')
      return
    }

    window.api.watchDraft(capCutDraftPath)

    return () => {
      window.api.unwatchDraft()
    }
  }, [capCutDraftPath, setCurrentView])

  // Listen for external project changes
  useEffect(() => {
    const cleanup = window.api.onProjectChanged((data) => {
      const change = data as {
        timestamp: number
        subtitleCount: number
        tracks: Array<{ type: string; segments: number }>
      }
      setExternalChange(change)
    })

    return cleanup
  }, [setExternalChange])

  const handleDismissChange = useCallback(() => {
    setExternalChange(null)
  }, [setExternalChange])

  const handleReloadFromCapCut = useCallback(async () => {
    if (!capCutDraftPath) return

    try {
      // Re-read audio blocks and subtitles from CapCut
      const [audioBlocks, subtitles] = await Promise.all([
        window.api.readAudioBlocks(capCutDraftPath),
        window.api.readSubtitles(capCutDraftPath)
      ])

      const { setAudioBlocks } = useProjectStore.getState()
      const mapped = (audioBlocks as Array<Record<string, unknown>>).map((a, i) => ({
        id: (a.segment_id as string) || crypto.randomUUID(),
        index: i,
        filePath: (a.file_path as string) || '',
        startMs: (a.start_ms as number) || 0,
        endMs: (a.end_ms as number) || 0,
        durationMs: (a.duration_ms as number) || 0,
        linkedBlockId: null,
        source: 'capcut' as const,
        textMaterialId: null,
        textSegmentId: null
      }))
      setAudioBlocks(mapped)

      const { addToast } = useUIStore.getState()
      addToast({
        type: 'info',
        message: `Recarregado: ${mapped.length} audios, ${(subtitles as unknown[]).length} legendas.`
      })
    } catch {
      const { addToast } = useUIStore.getState()
      addToast({ type: 'error', message: 'Erro ao recarregar dados do CapCut.' })
    }

    setExternalChange(null)
  }, [capCutDraftPath, setExternalChange])

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar />
      <StageProgress />

      {/* External change banner */}
      {externalChange && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mx-6 mt-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5"
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 text-xs text-text">
            <span className="font-medium">Projeto alterado no CapCut</span>
            <span className="text-text-muted ml-2">
              {externalChange.tracks.reduce((sum, t) => sum + t.segments, 0)} segmentos,{' '}
              {externalChange.subtitleCount} legendas
            </span>
          </div>
          <button
            onClick={handleReloadFromCapCut}
            className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Recarregar
          </button>
          <button
            onClick={handleDismissChange}
            className="rounded-md p-1 text-text-muted transition-colors hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      <main className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <StageContent />
          </motion.div>
        </AnimatePresence>
      </main>
      <TimelinePanel />
      <StatusBar />
    </div>
  )
}
