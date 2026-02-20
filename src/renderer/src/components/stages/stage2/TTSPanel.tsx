import { useState, useEffect, useRef } from 'react'
import { Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { VoiceSelector } from './VoiceSelector'
import { StyleSelector } from './StyleSelector'
import { TTSProgress } from './TTSProgress'
import { msToDisplay } from '@/lib/time'
import type { TtsGenerateResult, TtsProgressEvent, TtsChunkResult } from '@/types/tts'

export function TTSPanel(): React.JSX.Element {
  const { storyBlocks, ttsDefaults, setAudioBlocks } = useProjectStore()
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const [voice, setVoice] = useState(ttsDefaults.voice)
  const [style, setStyle] = useState(ttsDefaults.style)
  const [ttsModel, setTtsModel] = useState<'flash' | 'pro'>(ttsDefaults.ttsModel)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [editableText, setEditableText] = useState('')

  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState<TtsProgressEvent | null>(null)
  const [partsStatus, setPartsStatus] = useState<TtsChunkResult[]>([])
  const [totalChunks, setTotalChunks] = useState(0)

  const [result, setResult] = useState<TtsGenerateResult | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Populate text from Stage 1 storyBlocks
  useEffect(() => {
    if (storyBlocks.length > 0 && !editableText) {
      setEditableText(storyBlocks.map((b) => b.text).join('\n\n'))
    }
  }, [storyBlocks, editableText])

  // Subscribe to TTS progress events
  useEffect(() => {
    const unsubscribe = window.api.onTtsProgress((data) => {
      const evt = data as TtsProgressEvent
      setProgress(evt)
    })
    return unsubscribe
  }, [])

  const handleGenerate = async (): Promise<void> => {
    if (!editableText.trim()) {
      addToast({ type: 'warning', message: 'Insira texto para gerar audio.' })
      return
    }

    setGenerating(true)
    setProgress(null)
    setPartsStatus([])
    setResult(null)

    // Estimate chunks for UI
    const estimatedChunks = Math.max(1, Math.ceil(editableText.length / 2000))
    setTotalChunks(estimatedChunks)

    try {
      const res = (await window.api.ttsGenerate({
        text: editableText,
        voice,
        style,
        customStylePrompt: customPrompt || undefined,
        ttsModel,
        generateSrt: true
      })) as TtsGenerateResult

      if (res.success) {
        setResult(res)
        setPartsStatus(res.parts)
        setTotalChunks(res.parts.length)
        addToast({
          type: 'success',
          message: `Audio gerado: ${(res.total_duration_ms / 1000).toFixed(1)}s`
        })
      } else {
        addToast({ type: 'error', message: 'Falha na geracao do audio.' })
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao gerar audio.'
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleConfirm = (): void => {
    if (!result) return

    let cumulativeMs = 0
    const audioBlocks = result.parts
      .filter((p) => p.status === 'ok')
      .map((part, i) => {
        const block = {
          id: uuidv4(),
          index: i + 1,
          filePath: part.path,
          startMs: cumulativeMs,
          endMs: cumulativeMs + part.duration_ms,
          durationMs: part.duration_ms,
          linkedBlockId: null,
          source: 'tts' as const
        }
        cumulativeMs += part.duration_ms
        return block
      })

    setAudioBlocks(audioBlocks)
    completeStage(2)
    addToast({ type: 'success', message: 'Etapa 2 concluida. Avance para Sincronizacao.' })
  }

  const hasText = editableText.trim().length > 0
  const hasResult = result !== null && result.success

  return (
    <div className="flex flex-col gap-4">
      {/* Config row */}
      <div className="grid grid-cols-3 gap-3">
        <VoiceSelector value={voice} onChange={setVoice} />
        <StyleSelector value={style} onChange={setStyle} />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Modelo</span>
          <select
            value={ttsModel}
            onChange={(e) => setTtsModel(e.target.value as 'flash' | 'pro')}
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
          >
            <option value="flash">Flash (rapido)</option>
            <option value="pro">Pro (qualidade)</option>
          </select>
        </div>
      </div>

      {/* Custom prompt toggle */}
      <button
        type="button"
        onClick={() => setShowCustomPrompt(!showCustomPrompt)}
        className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
      >
        {showCustomPrompt ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Prompt customizado (override do estilo)
      </button>
      {showCustomPrompt && (
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Ex: Fale como um narrador de documentario sobre natureza..."
          rows={2}
          className="resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
        />
      )}

      {/* Text preview/editor */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Texto para narracao</span>
          <span className="text-[10px] text-text-muted/70">
            {editableText.length} caracteres
          </span>
        </div>
        <textarea
          value={editableText}
          onChange={(e) => setEditableText(e.target.value)}
          placeholder="Insira o texto que sera narrado..."
          rows={6}
          className="resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-primary"
        />
      </div>

      {/* Generate button */}
      {!hasResult && (
        <button
          type="button"
          disabled={!hasText || generating}
          onClick={handleGenerate}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando audio...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Gerar Audio
            </>
          )}
        </button>
      )}

      {/* Progress */}
      {generating && (
        <TTSProgress progress={progress} parts={partsStatus} totalChunks={totalChunks} />
      )}

      {/* Result */}
      {hasResult && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-text">Audio gerado</h4>
              <p className="text-xs text-text-muted">
                {result.parts.filter((p) => p.status === 'ok').length} partes,{' '}
                {msToDisplay(result.total_duration_ms)} total
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setProgress(null)
                  setPartsStatus([])
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
              >
                Refazer
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
              >
                Confirmar audio
              </button>
            </div>
          </div>

          {/* Audio player */}
          {result.combined_audio_path && (
            <audio
              ref={audioRef}
              controls
              src={`file://${result.combined_audio_path.replace(/\\/g, '/')}`}
              className="w-full"
            />
          )}

          {/* Parts list */}
          <TTSProgress progress={null} parts={result.parts} totalChunks={result.parts.length} />
        </div>
      )}
    </div>
  )
}
