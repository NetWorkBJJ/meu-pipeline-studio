import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Coins
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { msToDisplay } from '@/lib/time'
import { parseSrt, matchSrtToBlocks } from '@/lib/srt'
import type { SrtMatchResult } from '@/lib/srt'
import type {
  Ai33TaskResponse,
  Ai33TaskCreatedResponse,
  Ai33TTSMetadata,
  Ai33CreditsResponse,
  ElevenLabsVoiceSettings
} from '@/types/ai33'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type PanelPhase = 'idle' | 'generating' | 'done' | 'error'

interface GeneratedPart {
  index: number
  text: string
  localPath: string
  durationMs: number
  creditCost: number
}

interface VoicePreset {
  id: string
  name: string
  voiceId: string
  modelId: string
  voiceSettings: ElevenLabsVoiceSettings
}

const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'preset-lena-voice',
    name: 'Lena Oficial Voice',
    voiceId: 'KoVIHoyLDrQyd4pGalbs',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: {
      stability: 0.9,
      similarity_boost: 0.5,
      style: 0.3,
      use_speaker_boost: true,
      speed: 1.0
    }
  },
  {
    id: 'preset-jose',
    name: 'Kay&Rowan',
    voiceId: 'MFZUKuGQUsGJPQjTS4wC',
    modelId: 'eleven_multilingual_v2',
    voiceSettings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true,
      speed: 1.0
    }
  }
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ElevenLabsTTSPanel(): React.JSX.Element {
  const { storyBlocks, audioBlocks, setAudioBlocks, updateStoryBlock } = useProjectStore()
  const { completeStage, setCurrentStage } = useStageStore()
  const { addToast } = useUIStore()

  // API key
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)

  // Credits
  const [credits, setCredits] = useState<number | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)

  // Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>(VOICE_PRESETS[0].id)

  // Transcript
  const [withTranscript, setWithTranscript] = useState(true)

  // Text
  const [editableText, setEditableText] = useState('')

  // Generation state (single audio)
  const [phase, setPhase] = useState<PanelPhase>('idle')
  const [generatedAudio, setGeneratedAudio] = useState<GeneratedPart | null>(null)
  const [totalCreditCost, setTotalCreditCost] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Transcript sync
  const [srtMatchResults, setSrtMatchResults] = useState<SrtMatchResult[] | null>(null)
  const [srtDownloadFailed, setSrtDownloadFailed] = useState(false)

  // Cancellation ref
  const cancelledRef = useRef(false)

  const selectedPreset = VOICE_PRESETS.find((p) => p.id === selectedPresetId) ?? VOICE_PRESETS[0]

  // -----------------------------------------------------------------------
  // Mount: check API key, load credits
  // -----------------------------------------------------------------------

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const keyExists = await window.api.ai33HasApiKey()
        setHasApiKey(keyExists)
        if (keyExists) {
          loadCredits()
        }
      } catch {
        setHasApiKey(false)
      }
    }
    init()
  }, [])

  // Restore "done" state from persisted audioBlocks
  useEffect(() => {
    if (phase !== 'idle' || generatedAudio) return
    const ttsBlocks = audioBlocks.filter((b) => b.source === 'tts')
    if (ttsBlocks.length === 0) return

    const firstBlock = ttsBlocks[0]
    const totalDuration = ttsBlocks.length === 1
      ? firstBlock.durationMs
      : ttsBlocks.reduce((max, b) => Math.max(max, b.endMs), 0)

    setGeneratedAudio({
      index: 0,
      text: '',
      localPath: firstBlock.filePath,
      durationMs: totalDuration,
      creditCost: 0
    })

    // If multiple blocks are linked, they came from SRT matching
    if (ttsBlocks.length > 1 && ttsBlocks.every((b) => b.linkedBlockId)) {
      setSrtMatchResults(
        ttsBlocks.map((b, i) => ({
          blockId: b.linkedBlockId!,
          blockIndex: i,
          startMs: b.startMs,
          endMs: b.endMs,
          durationMs: b.durationMs,
          srtIndices: []
        }))
      )
    }

    setPhase('done')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Populate text from Stage 1 storyBlocks
  useEffect(() => {
    if (storyBlocks.length > 0 && !editableText) {
      setEditableText(storyBlocks.map((b) => b.text).join('\n\n'))
    }
  }, [storyBlocks, editableText])

  // -----------------------------------------------------------------------
  // Data loaders
  // -----------------------------------------------------------------------

  const loadCredits = async (): Promise<void> => {
    setLoadingCredits(true)
    try {
      const res = (await window.api.ai33GetCredits()) as Ai33CreditsResponse
      if (res.success) {
        setCredits(res.credits)
      }
    } catch {
      // silent - credits display is optional
    } finally {
      setLoadingCredits(false)
    }
  }

  // -----------------------------------------------------------------------
  // Generate TTS (single audio from all blocks)
  // -----------------------------------------------------------------------

  const handleGenerate = async (): Promise<void> => {
    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de legenda encontrado (Stage 1).' })
      return
    }

    const fullText = storyBlocks
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((b) => b.text.trim())
      .filter((t) => t.length > 0)
      .join('\n\n')

    if (!fullText) {
      addToast({ type: 'warning', message: 'Todos os blocos estao vazios.' })
      return
    }

    setPhase('generating')
    setErrorMessage(null)
    setGeneratedAudio(null)
    setTotalCreditCost(0)
    cancelledRef.current = false

    const timestamp = Date.now()
    const { voiceId, modelId, voiceSettings } = selectedPreset

    try {
      // 1. Create single TTS task with full text
      const createRes = (await window.api.ai33TtsElevenlabs({
        voiceId,
        text: fullText,
        model_id: modelId,
        with_transcript: withTranscript,
        speed: voiceSettings.speed ?? 1.0,
        voice_settings: {
          stability: voiceSettings.stability,
          similarity_boost: voiceSettings.similarity_boost,
          style: voiceSettings.style,
          use_speaker_boost: voiceSettings.use_speaker_boost
        }
      })) as Ai33TaskCreatedResponse

      if (!createRes.success || !createRes.task_id) {
        throw new Error('Falha ao criar task.')
      }

      // 2. Poll until done
      let taskResult: Ai33TaskResponse | null = null
      while (!cancelledRef.current) {
        await delay(2000)
        if (cancelledRef.current) break

        const pollRes = (await window.api.ai33PollTask(createRes.task_id)) as Ai33TaskResponse

        if (pollRes.status === 'done') {
          taskResult = pollRes
          break
        }
        if (pollRes.status === 'error') {
          throw new Error(pollRes.error_message || 'Erro no processamento.')
        }
      }

      if (!taskResult || cancelledRef.current) {
        if (cancelledRef.current) setPhase('idle')
        return
      }

      setTotalCreditCost(taskResult.credit_cost)

      // 3. Download audio
      const metadata = taskResult.metadata as Ai33TTSMetadata
      if (!metadata.audio_url) {
        throw new Error('Resposta sem URL de audio.')
      }

      const dlResult = (await window.api.ai33DownloadFile({
        url: metadata.audio_url,
        fileName: `elevenlabs_tts_${timestamp}_full.mp3`
      })) as { success: boolean; localPath: string; size: number }

      if (!dlResult.success) {
        throw new Error('Falha ao baixar audio.')
      }

      // 4. Detect duration
      const durationMs = await getAudioDuration(dlResult.localPath)

      setGeneratedAudio({
        index: 0,
        text: fullText,
        localPath: dlResult.localPath,
        durationMs,
        creditCost: taskResult.credit_cost
      })

      // 5. Download and parse SRT transcript for precise block timing
      setSrtMatchResults(null)
      setSrtDownloadFailed(false)

      if (withTranscript && metadata.srt_url) {
        try {
          const srtDlResult = (await window.api.ai33DownloadFile({
            url: metadata.srt_url,
            fileName: `elevenlabs_tts_${timestamp}_full.srt`
          })) as { success: boolean; localPath: string; size: number }

          if (srtDlResult.success) {
            const srtContent = await window.api.readTextFile(srtDlResult.localPath)
            console.log('[ElevenLabs] SRT content length:', srtContent.length)
            const parsed = parseSrt(srtContent)
            console.log('[ElevenLabs] SRT parsed blocks:', parsed.length)

            if (parsed.length > 0) {
              const matches = matchSrtToBlocks(parsed, storyBlocks)
              const validMatches = matches.filter((m) => m.durationMs > 0)
              console.log(
                '[ElevenLabs] SRT match results:',
                matches.length,
                'valid:',
                validMatches.length,
                'blocks:',
                storyBlocks.length
              )
              if (validMatches.length === matches.length) {
                setSrtMatchResults(matches)
              } else {
                console.warn('[ElevenLabs] SRT match incomplete, falling back to proportional')
                setSrtDownloadFailed(true)
              }
            } else {
              console.warn('[ElevenLabs] SRT parse returned 0 blocks')
              setSrtDownloadFailed(true)
            }
          } else {
            console.warn('[ElevenLabs] SRT download failed')
            setSrtDownloadFailed(true)
          }
        } catch (srtErr) {
          console.error('[ElevenLabs] SRT processing error:', srtErr)
          setSrtDownloadFailed(true)
        }
      } else {
        console.log(
          '[ElevenLabs] SRT skipped: withTranscript=',
          withTranscript,
          'srt_url=',
          metadata.srt_url
        )
      }

      setPhase('done')
      loadCredits()
      addToast({ type: 'success', message: 'Audio gerado com sucesso.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.'
      setPhase('error')
      setErrorMessage(msg)
    }
  }

  // -----------------------------------------------------------------------
  // Confirm: create AudioBlocks and advance pipeline
  // -----------------------------------------------------------------------

  const handleConfirm = async (): Promise<void> => {
    if (!generatedAudio) return

    const audioBlocks =
      srtMatchResults && srtMatchResults.length === storyBlocks.length
        ? srtMatchResults.map((match, i) => ({
            id: uuidv4(),
            index: i + 1,
            filePath: generatedAudio.localPath,
            startMs: match.startMs,
            endMs: match.endMs,
            durationMs: match.durationMs,
            linkedBlockId: match.blockId,
            source: 'tts' as const
          }))
        : [
            {
              id: uuidv4(),
              index: 1,
              filePath: generatedAudio.localPath,
              startMs: 0,
              endMs: generatedAudio.durationMs,
              durationMs: generatedAudio.durationMs,
              linkedBlockId: null,
              source: 'tts' as const
            }
          ]

    console.log(
      '[ElevenLabs] handleConfirm: audioBlocks created:',
      audioBlocks.length,
      'hasLinkedBlockId:',
      audioBlocks.some((b) => b.linkedBlockId !== null),
      'first:',
      JSON.stringify(audioBlocks[0])
    )
    setAudioBlocks(audioBlocks)

    const hasSrtMatch = srtMatchResults && srtMatchResults.length === storyBlocks.length
    if (hasSrtMatch) {
      for (const match of srtMatchResults) {
        updateStoryBlock(match.blockId, {
          startMs: match.startMs,
          endMs: match.endMs,
          durationMs: match.durationMs
        })
      }
    }

    // Insert audio + text segments into CapCut
    const draftPath = useProjectStore.getState().capCutDraftPath
    if (draftPath) {
      try {
        await window.api.clearAudioSegments(draftPath)
        await window.api.insertAudioBatch({
          draftPath,
          audioFiles: [generatedAudio.localPath],
          durationsMs: [generatedAudio.durationMs],
          useExistingTrack: false
        })

        if (hasSrtMatch) {
          await window.api.clearTextSegments(draftPath)

          const updatedBlocks = useProjectStore.getState().storyBlocks
          const textBlocks = [...updatedBlocks]
            .sort((a, b) => a.index - b.index)
            .map((b) => ({
              text: b.text,
              start_ms: b.startMs,
              end_ms: b.endMs
            }))

          const textResult = (await window.api.writeTextSegments(draftPath, textBlocks)) as {
            added_count: number
            segments: Array<{ segment_id: string; material_id: string; text: string }>
          }

          if (textResult.segments) {
            const sorted = [...useProjectStore.getState().storyBlocks].sort(
              (a, b) => a.index - b.index
            )
            for (let i = 0; i < textResult.segments.length && i < sorted.length; i++) {
              const seg = textResult.segments[i]
              updateStoryBlock(sorted[i].id, {
                textMaterialId: seg.material_id,
                textSegmentId: seg.segment_id
              })
            }
          }
        }

        await window.api.syncMetadata(draftPath)
      } catch {
        addToast({ type: 'warning', message: 'Audio gerado mas nao inserido no CapCut.' })
      }
    }

    completeStage(2)
    addToast({ type: 'success', message: 'Etapa 2 concluida.' })
    setTimeout(() => setCurrentStage(3), 400)
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  const handleRefazer = (): void => {
    cancelledRef.current = true
    setPhase('idle')
    setGeneratedAudio(null)
    setTotalCreditCost(0)
    setErrorMessage(null)
    setSrtMatchResults(null)
    setSrtDownloadFailed(false)
    setAudioBlocks([])
  }

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const isWorking = phase === 'generating'
  const totalDurationMs = generatedAudio?.durationMs ?? 0

  // -----------------------------------------------------------------------
  // Render: API key not configured
  // -----------------------------------------------------------------------

  if (hasApiKey === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4">
        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
        <span className="text-sm text-text-muted">Verificando API key...</span>
      </div>
    )
  }

  if (!hasApiKey) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-text">API key ai33.pro nao configurada</p>
          <p className="text-xs text-text-muted">
            Configure sua API key nas configuracoes para usar o ElevenLabs via ai33.pro.
          </p>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Credits display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-text-muted" />
          <span className="text-xs text-text-muted">
            Creditos:{' '}
            {loadingCredits ? (
              <Loader2 className="inline h-3 w-3 animate-spin" />
            ) : credits !== null ? (
              <span className="font-medium text-text">{credits.toFixed(2)}</span>
            ) : (
              '--'
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={loadCredits}
          disabled={loadingCredits}
          className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text"
        >
          <RefreshCw className={`h-3 w-3 ${loadingCredits ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Voice preset selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-muted">Voz</span>
        <select
          value={selectedPresetId}
          onChange={(e) => setSelectedPresetId(e.target.value)}
          disabled={isWorking || phase === 'done'}
          className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary disabled:opacity-50"
        >
          {VOICE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* With transcript toggle */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={withTranscript}
          onChange={(e) => setWithTranscript(e.target.checked)}
          disabled={isWorking || phase === 'done'}
          className="h-3.5 w-3.5 rounded border-border bg-bg accent-primary"
        />
        <span className="text-xs text-text-muted">Gerar transcricao (SRT)</span>
      </label>

      {/* Block count info */}
      {storyBlocks.length > 0 && phase === 'idle' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
          <span className="text-xs text-text-muted">
            {storyBlocks.length} blocos de legenda serao concatenados em um unico audio
          </span>
        </div>
      )}

      {/* Generate button */}
      {phase === 'idle' && (
        <button
          type="button"
          disabled={storyBlocks.length === 0}
          onClick={handleGenerate}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          Gerar Audio
        </button>
      )}

      {/* Progress during generation */}
      {isWorking && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-text">Gerando audio...</span>
            </div>
            <button
              type="button"
              onClick={handleRefazer}
              className="text-[11px] text-text-muted transition-colors hover:text-red-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-text">{errorMessage || 'Erro desconhecido.'}</span>
          </div>
          <button
            type="button"
            onClick={handleRefazer}
            className="flex h-8 w-fit items-center gap-2 rounded-lg border border-border px-3 text-xs text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* Result */}
      {phase === 'done' && generatedAudio && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <h4 className="text-sm font-medium text-text">Audio gerado</h4>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-xs text-text-muted">
                  Duracao: {msToDisplay(totalDurationMs)}
                </span>
                {totalCreditCost > 0 && (
                  <span className="text-xs text-text-muted">
                    Custo: {totalCreditCost.toFixed(2)} creditos
                  </span>
                )}
                {srtMatchResults && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    {srtMatchResults.length} blocos sincronizados
                  </span>
                )}
                {srtDownloadFailed && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    Sync proporcional (sem transcript)
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRefazer}
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
          <audio
            controls
            src={`file://${generatedAudio.localPath.replace(/\\/g, '/')}`}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio(`file://${filePath.replace(/\\/g, '/')}`)
    audio.onloadedmetadata = (): void => {
      resolve(Math.round(audio.duration * 1000))
    }
    audio.onerror = (): void => {
      resolve(0)
    }
  })
}
