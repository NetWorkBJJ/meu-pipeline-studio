import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X, Loader2 } from 'lucide-react'
import { TopBar } from './TopBar'
import { StageProgress } from './StageProgress'
import { ProjectSummaryBar } from './ProjectSummaryBar'
import { TimelinePanel } from '../timeline/TimelinePanel'
import { useStageStore } from '@/stores/useStageStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { useLogStore } from '@/stores/useLogStore'
import { Stage1Script } from '../stages/stage1/Stage1Script'
import { Stage2Audio } from '../stages/stage2/Stage2Audio'
import { Stage3Sync } from '../stages/stage3/Stage3Sync'
import { Stage4Director } from '../stages/stage4/Stage4Director'
import { Stage5Veo3 } from '../stages/stage5/Stage5Veo3'

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
    default:
      return <Stage1Script />
  }
}

export function PipelineWorkspace(): React.JSX.Element {
  const { currentStage } = useStageStore()
  const { capCutDraftPath } = useProjectStore()
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const { setCurrentView, externalChange, setExternalChange, addToast } = useUIStore()

  // Start/stop file watcher when draft path changes
  useEffect(() => {
    if (!capCutDraftPath) {
      setCurrentView('projectDashboard')
      return
    }

    window.api.watchDraft(capCutDraftPath)

    // Fallback: if project not loaded yet (e.g. page reload), trigger load
    if (!useProjectStore.getState().projectLoaded) {
      useProjectStore.getState().loadFullProject(capCutDraftPath).catch(() => {})
    }

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

      const { addLog } = useLogStore.getState()
      const totalSegments = change.tracks?.reduce((sum, t) => sum + t.segments, 0) ?? 0
      const textSegments = change.tracks?.filter((t) => t.type === 'text').reduce((sum, t) => sum + t.segments, 0) ?? 0
      const audioSegments = change.tracks?.filter((t) => t.type === 'audio').reduce((sum, t) => sum + t.segments, 0) ?? 0

      addLog('info', `[draft-watcher] Mudanca externa detectada: ${totalSegments} seg total, ${textSegments} texto, ${audioSegments} audio, ${change.subtitleCount} legendas`)

      // Log current in-memory state for comparison
      const { storyBlocks, audioBlocks } = useProjectStore.getState()
      addLog('info', `[draft-watcher] Estado em memoria: ${storyBlocks.length} storyBlocks, ${audioBlocks.length} audioBlocks`)
      if (storyBlocks.length > 0) {
        const first = storyBlocks[0]
        const last = storyBlocks[storyBlocks.length - 1]
        addLog('info', `[draft-watcher] StoryBlocks timing: primeiro=[${first.startMs}-${first.endMs}ms], ultimo=[${last.startMs}-${last.endMs}ms], linkedAudio=${first.linkedAudioId ? 'sim' : 'nao'}`)
      }
      if (audioBlocks.length > 0) {
        addLog('info', `[draft-watcher] AudioBlocks: ${audioBlocks.map((a) => `[${a.startMs}-${a.endMs}ms linked=${a.linkedBlockId || 'null'}]`).join(', ')}`)
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

    const { addLog } = useLogStore.getState()
    const before = useProjectStore.getState()
    addLog('warning', `[reload] ANTES do reload: ${before.storyBlocks.length} storyBlocks, ${before.audioBlocks.length} audioBlocks`)
    if (before.storyBlocks.length > 0) {
      const first = before.storyBlocks[0]
      addLog('warning', `[reload] StoryBlocks[0] timing ANTES: start=${first.startMs}ms end=${first.endMs}ms linkedAudio=${first.linkedAudioId || 'null'}`)
    }

    try {
      await useProjectStore.getState().loadFullProject(capCutDraftPath)

      const after = useProjectStore.getState()
      addLog('warning', `[reload] DEPOIS do reload: ${after.storyBlocks.length} storyBlocks, ${after.audioBlocks.length} audioBlocks`)
      if (after.storyBlocks.length > 0) {
        const first = after.storyBlocks[0]
        addLog('warning', `[reload] StoryBlocks[0] timing DEPOIS: start=${first.startMs}ms end=${first.endMs}ms linkedAudio=${first.linkedAudioId || 'null'}`)
      }
      if (after.audioBlocks.length > 0) {
        addLog('warning', `[reload] AudioBlocks DEPOIS: ${after.audioBlocks.map((a) => `[${a.startMs}-${a.endMs}ms]`).join(', ')}`)
      }

      addToast({ type: 'info', message: 'Projeto recarregado.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao recarregar dados do CapCut.' })
    }

    setExternalChange(null)
  }, [capCutDraftPath, setExternalChange, addToast])

  const isVeo3Stage = currentStage === 5

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar />
      <StageProgress />
      {!isVeo3Stage && <ProjectSummaryBar />}

      {/* External change banner */}
      {!isVeo3Stage && externalChange && (
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

      {/* VEO3 stage: always mounted to preserve webviews, independent of project loading */}
      <div
        className={`flex-1 overflow-hidden ${isVeo3Stage ? '' : 'hidden'}`}
      >
        <Stage5Veo3 />
      </div>

      {/* Loading state (stages 1-4 only) */}
      {!isVeo3Stage && !projectLoaded && capCutDraftPath && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-text-muted">Carregando projeto...</span>
        </div>
      )}

      {/* Stages 1-4: normal animated transitions, only when loaded */}
      {!isVeo3Stage && (projectLoaded || !capCutDraftPath) && (
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
      )}

      {!isVeo3Stage && <TimelinePanel />}
    </div>
  )
}
