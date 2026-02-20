import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileText, PenLine, CheckCircle2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { splitScriptIntoBlocks } from '@/lib/scriptSplitter'
import { msToDisplay } from '@/lib/time'
import { ScriptInput } from './ScriptInput'
import { BlocksPreview } from './BlocksPreview'

type Stage1View = 'existing' | 'input' | 'preview'

export function Stage1Script(): React.JSX.Element {
  const storyBlocks = useProjectStore((s) => s.storyBlocks)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const { setStoryBlocks } = useProjectStore()
  const { completeStage } = useStageStore()
  const completedStages = useStageStore((s) => s.completedStages)
  const { addToast } = useUIStore()

  // Detect existing text from CapCut project
  const hasExistingText = projectLoaded && storyBlocks.length > 0 && storyBlocks.some((b) => b.textMaterialId)
  const stageAlreadyComplete = completedStages.has(1)

  const [view, setView] = useState<Stage1View>(
    hasExistingText && !stageAlreadyComplete ? 'existing' : 'input'
  )
  const [writing, setWriting] = useState(false)

  const handleUseExisting = (): void => {
    completeStage(1)
    addToast({
      type: 'success',
      message: `${storyBlocks.length} legendas existentes aceitas.`
    })
  }

  const handleNewScript = (): void => {
    setView('input')
  }

  const handleSplit = (): void => {
    const { rawScript } = useProjectStore.getState()
    if (!rawScript.trim()) return

    const blocks = splitScriptIntoBlocks(rawScript)
    setStoryBlocks(blocks)

    if (blocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco gerado. Verifique o roteiro.' })
      return
    }

    addToast({
      type: 'success',
      message: blocks.length + ' blocos gerados com sucesso.'
    })
    setView('preview')
  }

  const handleConfirm = async (): Promise<void> => {
    const { capCutDraftPath, storyBlocks: blocks } = useProjectStore.getState()

    if (!capCutDraftPath) {
      addToast({ type: 'error', message: 'Nenhum projeto CapCut selecionado.' })
      return
    }

    if (blocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco para inserir.' })
      return
    }

    setWriting(true)
    try {
      const mapped = blocks.map((block) => ({
        text: block.text,
        start_ms: block.startMs,
        end_ms: block.endMs
      }))

      const result = (await window.api.writeTextSegments(capCutDraftPath, mapped)) as {
        added_count: number
        segments: Array<{ segment_id: string; material_id: string; text: string }>
      }

      // Store CapCut IDs on each storyBlock for future re-sync
      if (result.segments) {
        const { updateStoryBlock } = useProjectStore.getState()
        const currentBlocks = useProjectStore.getState().storyBlocks
        for (let i = 0; i < result.segments.length && i < currentBlocks.length; i++) {
          const seg = result.segments[i]
          updateStoryBlock(currentBlocks[i].id, {
            textMaterialId: seg.material_id,
            textSegmentId: seg.segment_id
          })
        }
      }

      await window.api.syncMetadata(capCutDraftPath)

      addToast({
        type: 'success',
        message: `${result.added_count} legendas inseridas no CapCut.`
      })

      completeStage(1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao inserir legendas'
      addToast({ type: 'error', message })
    } finally {
      setWriting(false)
    }
  }

  const handleBack = (): void => {
    if (hasExistingText) {
      setView('existing')
    } else {
      setView('input')
    }
  }

  const totalDurationMs = storyBlocks.length > 0 ? storyBlocks[storyBlocks.length - 1].endMs : 0

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
      >
        {view === 'existing' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-text">
                  {storyBlocks.length} legendas detectadas no projeto
                </h3>
                <p className="mt-1 text-xs text-text-muted">
                  Duracao total: {msToDisplay(totalDurationMs)} |{' '}
                  {storyBlocks.reduce((sum, b) => sum + b.characterCount, 0)} caracteres
                </p>
                <div className="mt-3 max-h-48 overflow-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {storyBlocks.slice(0, 8).map((b) => (
                        <tr key={b.id} className="border-b border-border/30 last:border-0">
                          <td className="w-8 px-2 py-1.5 text-text-muted">{b.index}</td>
                          <td className="max-w-0 truncate px-2 py-1.5 text-text">{b.text}</td>
                          <td className="w-16 px-2 py-1.5 text-right font-mono text-text-muted">
                            {msToDisplay(b.durationMs)}
                          </td>
                        </tr>
                      ))}
                      {storyBlocks.length > 8 && (
                        <tr>
                          <td colSpan={3} className="px-2 py-1.5 text-center text-text-muted">
                            +{storyBlocks.length - 8} blocos...
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
                onClick={handleNewScript}
                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
              >
                <PenLine className="h-3.5 w-3.5" />
                Novo roteiro
              </button>
              <button
                onClick={handleUseExisting}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Usar legendas existentes
              </button>
            </div>
          </div>
        ) : view === 'preview' ? (
          <BlocksPreview onConfirm={handleConfirm} onBack={handleBack} loading={writing} />
        ) : (
          <ScriptInput onSplit={handleSplit} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
