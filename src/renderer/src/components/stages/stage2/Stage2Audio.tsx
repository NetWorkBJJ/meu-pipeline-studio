import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { DraftSelector } from './DraftSelector'
import { AudioBlocksList } from './AudioBlocksList'

type Stage2View = 'select' | 'preview'

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
  const [view, setView] = useState<Stage2View>('select')
  const { setAudioBlocks, capCutDraftPath } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast, setLoading } = useUIStore()

  const handleDraftLoaded = async (): Promise<void> => {
    if (!capCutDraftPath) return

    try {
      setLoading(true, 'Lendo blocos de audio...')
      const rawBlocks = (await window.api.readAudioBlocks(capCutDraftPath)) as RawAudioBlock[]

      const audioBlocks = rawBlocks.map((raw, i) => ({
        id: uuidv4(),
        index: i + 1,
        filePath: raw.file_path,
        startMs: raw.start_ms,
        endMs: raw.end_ms,
        durationMs: raw.duration_ms,
        linkedBlockId: null,
        source: 'capcut' as const
      }))

      setAudioBlocks(audioBlocks)
      setLoading(false)

      if (audioBlocks.length === 0) {
        addToast({ type: 'warning', message: 'Nenhum bloco de audio encontrado no projeto.' })
        return
      }

      addToast({ type: 'success', message: `${audioBlocks.length} blocos de audio detectados.` })
      setView('preview')
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
    setView('select')
  }

  if (view === 'preview') {
    return <AudioBlocksList onConfirm={handleConfirm} onBack={handleBack} />
  }

  return <DraftSelector onDraftLoaded={handleDraftLoaded} />
}
