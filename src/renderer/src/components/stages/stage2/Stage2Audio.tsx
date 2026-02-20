import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, CheckCircle2, RefreshCw } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { msToDisplay } from '@/lib/time'
import { DraftSelector } from './DraftSelector'
import { AudioBlocksList } from './AudioBlocksList'
import { AudioModeSelector } from './AudioModeSelector'
import { TTSPanel } from './TTSPanel'

type AudioMode = 'capcut' | 'tts'
type CapCutView = 'existing' | 'select' | 'preview'

interface RawAudioBlock {
  id: string
  material_id: string
  start_ms: number
  end_ms: number
  duration_ms: number
  file_path: string
  tone_type: string
  tone_platform: string
}

export function Stage2Audio(): React.JSX.Element {
  const audioBlocks = useProjectStore((s) => s.audioBlocks)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const capCutDraftPath = useProjectStore((s) => s.capCutDraftPath)
  const { setAudioBlocks } = useProjectStore()
  const { completeStage } = useStageStore()
  const completedStages = useStageStore((s) => s.completedStages)
  const { addToast, setLoading } = useUIStore()

  // Detect existing audio from CapCut project
  const hasExistingAudio = projectLoaded && audioBlocks.length > 0 && audioBlocks.some((b) => b.source === 'capcut')
  const stageAlreadyComplete = completedStages.has(2)

  const [mode, setMode] = useState<AudioMode>('capcut')
  const [capCutView, setCapCutView] = useState<CapCutView>(
    hasExistingAudio && !stageAlreadyComplete ? 'existing' : 'select'
  )

  const handleUseExisting = (): void => {
    completeStage(2)
    addToast({
      type: 'success',
      message: `${audioBlocks.length} blocos de audio existentes aceitos.`
    })
  }

  const handleReread = async (): Promise<void> => {
    if (!capCutDraftPath) return
    try {
      setLoading(true, 'Relendo blocos de audio...')
      const rawBlocks = (await window.api.readAudioBlocks(capCutDraftPath)) as RawAudioBlock[]
      const mapped = rawBlocks.map((raw, i) => ({
        id: uuidv4(),
        index: i + 1,
        filePath: raw.file_path,
        startMs: raw.start_ms,
        endMs: raw.end_ms,
        durationMs: raw.duration_ms,
        linkedBlockId: null,
        source: 'capcut' as const
      }))
      setAudioBlocks(mapped)
      setLoading(false)
      addToast({ type: 'success', message: `${mapped.length} blocos de audio relidos.` })
      setCapCutView('preview')
    } catch {
      setLoading(false)
      addToast({ type: 'error', message: 'Erro ao reler blocos de audio.' })
    }
  }

  const handleDraftLoaded = async (): Promise<void> => {
    if (!capCutDraftPath) return

    try {
      setLoading(true, 'Lendo blocos de audio...')
      const rawBlocks = (await window.api.readAudioBlocks(capCutDraftPath)) as RawAudioBlock[]

      const mapped = rawBlocks.map((raw, i) => ({
        id: uuidv4(),
        index: i + 1,
        filePath: raw.file_path,
        startMs: raw.start_ms,
        endMs: raw.end_ms,
        durationMs: raw.duration_ms,
        linkedBlockId: null,
        source: 'capcut' as const
      }))

      setAudioBlocks(mapped)
      setLoading(false)

      if (mapped.length === 0) {
        addToast({ type: 'warning', message: 'Nenhum bloco de audio encontrado no projeto.' })
        return
      }

      addToast({ type: 'success', message: `${mapped.length} blocos de audio detectados.` })
      setCapCutView('preview')
    } catch {
      setLoading(false)
      addToast({ type: 'error', message: 'Erro ao ler blocos de audio.' })
    }
  }

  const handleConfirm = (): void => {
    completeStage(2)
    addToast({ type: 'success', message: 'Etapa 2 concluida. Avance para Sincronizacao.' })
  }

  const handleBack = (): void => {
    if (hasExistingAudio) {
      setCapCutView('existing')
    } else {
      setCapCutView('select')
    }
  }

  const totalDurationMs = audioBlocks.length > 0 ? audioBlocks[audioBlocks.length - 1].endMs : 0

  return (
    <div>
      <AudioModeSelector mode={mode} onModeChange={setMode} />

      <AnimatePresence mode="wait">
        {mode === 'tts' ? (
          <motion.div
            key="tts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <TTSPanel />
          </motion.div>
        ) : capCutView === 'existing' ? (
          <motion.div
            key="existing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-text">
                    {audioBlocks.length} blocos de audio detectados no projeto
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Duracao total: {msToDisplay(totalDurationMs)} |{' '}
                    Fonte: {audioBlocks.filter((b) => b.source === 'capcut').length} CapCut
                  </p>
                  <div className="mt-3 max-h-40 overflow-auto rounded border border-border">
                    <table className="w-full text-xs">
                      <tbody>
                        {audioBlocks.slice(0, 6).map((b) => (
                          <tr key={b.id} className="border-b border-border/30 last:border-0">
                            <td className="w-8 px-2 py-1.5 text-text-muted">{b.index}</td>
                            <td className="max-w-0 truncate px-2 py-1.5 font-mono text-text-muted">
                              {b.filePath.split(/[/\\]/).pop() || 'Audio'}
                            </td>
                            <td className="w-16 px-2 py-1.5 text-right font-mono text-text-muted">
                              {msToDisplay(b.durationMs)}
                            </td>
                          </tr>
                        ))}
                        {audioBlocks.length > 6 && (
                          <tr>
                            <td colSpan={3} className="px-2 py-1.5 text-center text-text-muted">
                              +{audioBlocks.length - 6} blocos...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReread}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reler do CapCut
                </button>
                <button
                  onClick={handleUseExisting}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Usar audio existente
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`capcut-${capCutView}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {capCutView === 'preview' ? (
              <AudioBlocksList onConfirm={handleConfirm} onBack={handleBack} />
            ) : (
              <DraftSelector onDraftLoaded={handleDraftLoaded} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
