import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { splitScriptIntoBlocks } from '@/lib/scriptSplitter'
import { ScriptInput } from './ScriptInput'
import { BlocksPreview } from './BlocksPreview'

type Stage1View = 'input' | 'preview'

export function Stage1Script(): React.JSX.Element {
  const [view, setView] = useState<Stage1View>('input')
  const [writing, setWriting] = useState(false)
  const { setStoryBlocks } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

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
    const { capCutDraftPath, storyBlocks } = useProjectStore.getState()

    if (!capCutDraftPath) {
      addToast({ type: 'error', message: 'Nenhum projeto CapCut selecionado.' })
      return
    }

    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco para inserir.' })
      return
    }

    setWriting(true)
    try {
      const blocks = storyBlocks.map((block) => ({
        text: block.text,
        start_ms: block.startMs,
        end_ms: block.endMs
      }))

      const result = (await window.api.writeTextSegments(capCutDraftPath, blocks)) as {
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
    setView('input')
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
      >
        {view === 'preview' ? (
          <BlocksPreview onConfirm={handleConfirm} onBack={handleBack} loading={writing} />
        ) : (
          <ScriptInput onSplit={handleSplit} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}
