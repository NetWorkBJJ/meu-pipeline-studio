import { useState } from 'react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { splitScriptIntoBlocks } from '@/lib/scriptSplitter'
import { ScriptInput } from './ScriptInput'
import { BlocksPreview } from './BlocksPreview'

type Stage1View = 'input' | 'preview'

export function Stage1Script(): React.JSX.Element {
  const [view, setView] = useState<Stage1View>('input')
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

  const handleConfirm = (): void => {
    completeStage(1)
    addToast({ type: 'success', message: 'Etapa 1 concluida. Avance para Audio.' })
  }

  const handleBack = (): void => {
    setView('input')
  }

  if (view === 'preview') {
    return <BlocksPreview onConfirm={handleConfirm} onBack={handleBack} />
  }

  return <ScriptInput onSplit={handleSplit} />
}
