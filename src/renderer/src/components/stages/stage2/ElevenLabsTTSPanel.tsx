import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Pause,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Volume2,
  Coins,
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
  BookMarked
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { msToDisplay } from '@/lib/time'
import { parseSrt, matchSrtToBlocks } from '@/lib/srt'
import type { SrtMatchResult } from '@/lib/srt'
import type {
  Ai33ElevenLabsVoice,
  Ai33TaskResponse,
  Ai33TaskCreatedResponse,
  Ai33TTSMetadata,
  Ai33CreditsResponse,
  Ai33VoicesResponse,
  ElevenLabsVoiceSettings,
  ElevenLabsVoiceTemplate
} from '@/types/ai33'
import { ELEVENLABS_MODELS } from '@/types/ai33'

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

const DEFAULT_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ElevenLabsTTSPanel(): React.JSX.Element {
  const {
    storyBlocks,
    setAudioBlocks,
    elevenLabsVoiceTemplates,
    addElevenLabsVoiceTemplate,
    removeElevenLabsVoiceTemplate
  } = useProjectStore()
  const { completeStage, setCurrentStage } = useStageStore()
  const { addToast } = useUIStore()

  // API key
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)

  // Credits
  const [credits, setCredits] = useState<number | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)

  // Voices
  const [voices, setVoices] = useState<Ai33ElevenLabsVoice[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState('')

  // Model
  const [modelId, setModelId] = useState<string>(ELEVENLABS_MODELS[0].id)

  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<ElevenLabsVoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)

  // Template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

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

  // Audio preview
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null)

  // Cancellation ref
  const cancelledRef = useRef(false)

  // -----------------------------------------------------------------------
  // Mount: check API key, load voices, load credits
  // -----------------------------------------------------------------------

  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        const keyExists = await window.api.ai33HasApiKey()
        setHasApiKey(keyExists)
        if (keyExists) {
          loadVoices()
          loadCredits()
        }
      } catch {
        setHasApiKey(false)
      }
    }
    init()
  }, [])

  // Populate text from Stage 1 storyBlocks
  useEffect(() => {
    if (storyBlocks.length > 0 && !editableText) {
      setEditableText(storyBlocks.map((b) => b.text).join('\n\n'))
    }
  }, [storyBlocks, editableText])

  // -----------------------------------------------------------------------
  // Template handling
  // -----------------------------------------------------------------------

  const handleSelectTemplate = (templateId: string): void => {
    setSelectedTemplateId(templateId)
    if (!templateId) return

    const template = elevenLabsVoiceTemplates.find((t) => t.id === templateId)
    if (!template) return

    setSelectedVoiceId(template.voiceId)
    setModelId(template.modelId)
    setVoiceSettings({ ...template.voiceSettings })
  }

  const handleSaveTemplate = (): void => {
    const name = newTemplateName.trim()
    if (!name) {
      addToast({ type: 'warning', message: 'Digite um nome para o template.' })
      return
    }
    if (!selectedVoiceId) {
      addToast({ type: 'warning', message: 'Selecione uma voz primeiro.' })
      return
    }

    const voiceName = selectedVoice?.name || selectedVoiceId

    const template: ElevenLabsVoiceTemplate = {
      id: uuidv4(),
      name,
      voiceId: selectedVoiceId,
      voiceName,
      modelId,
      voiceSettings: { ...voiceSettings },
      createdAt: Date.now()
    }

    addElevenLabsVoiceTemplate(template)
    setSelectedTemplateId(template.id)
    setShowSaveTemplate(false)
    setNewTemplateName('')
    addToast({ type: 'success', message: `Template "${name}" salvo.` })
  }

  const handleDeleteTemplate = (id: string): void => {
    removeElevenLabsVoiceTemplate(id)
    if (selectedTemplateId === id) {
      setSelectedTemplateId('')
    }
    addToast({ type: 'info', message: 'Template removido.' })
  }

  // -----------------------------------------------------------------------
  // Data loaders
  // -----------------------------------------------------------------------

  const loadVoices = async (): Promise<void> => {
    setLoadingVoices(true)
    try {
      const res = (await window.api.ai33GetVoices()) as Ai33VoicesResponse
      if (res.voices && res.voices.length > 0) {
        setVoices(res.voices)
        if (!selectedVoiceId) {
          setSelectedVoiceId(res.voices[0].voice_id)
        }
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao carregar vozes.'
      })
    } finally {
      setLoadingVoices(false)
    }
  }

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
  // Voice preview
  // -----------------------------------------------------------------------

  const handlePreviewVoice = useCallback(
    (voice: Ai33ElevenLabsVoice) => {
      if (!voice.preview_url) return

      if (previewPlaying && previewVoiceId === voice.voice_id) {
        if (previewAudioRef.current) {
          previewAudioRef.current.pause()
          previewAudioRef.current.currentTime = 0
        }
        setPreviewPlaying(false)
        setPreviewVoiceId(null)
        return
      }

      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
      }

      const audio = new Audio(voice.preview_url)
      previewAudioRef.current = audio
      setPreviewVoiceId(voice.voice_id)
      setPreviewPlaying(true)

      audio.play().catch(() => {
        setPreviewPlaying(false)
        setPreviewVoiceId(null)
      })

      audio.onended = (): void => {
        setPreviewPlaying(false)
        setPreviewVoiceId(null)
      }
    },
    [previewPlaying, previewVoiceId]
  )

  // -----------------------------------------------------------------------
  // Generate TTS (single audio from all blocks)
  // -----------------------------------------------------------------------

  const handleGenerate = async (): Promise<void> => {
    if (storyBlocks.length === 0) {
      addToast({ type: 'warning', message: 'Nenhum bloco de legenda encontrado (Stage 1).' })
      return
    }
    if (!selectedVoiceId) {
      addToast({ type: 'warning', message: 'Selecione uma voz.' })
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

    try {
      // 1. Create single TTS task with full text
      const createRes = (await window.api.ai33TtsElevenlabs({
        voiceId: selectedVoiceId,
        text: fullText,
        model_id: modelId,
        with_transcript: withTranscript,
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
            // Read SRT via main process IPC (fetch('file://') can fail in Electron)
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
  // Confirm: create single AudioBlock and advance pipeline
  // -----------------------------------------------------------------------

  const handleConfirm = async (): Promise<void> => {
    if (!generatedAudio) return

    // Create AudioBlocks: per-block with precise timing (transcript) or single (fallback)
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

    // Insert into CapCut as single audio segment (always 1 file on the timeline)
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
  }

  // -----------------------------------------------------------------------
  // Filtered voices
  // -----------------------------------------------------------------------

  const filteredVoices = voices.filter((v) => {
    if (!voiceSearch.trim()) return true
    const search = voiceSearch.toLowerCase()
    const nameMatch = v.name.toLowerCase().includes(search)
    const categoryMatch = v.category?.toLowerCase().includes(search) ?? false
    const labelMatch = v.labels
      ? Object.values(v.labels).some((val) => val.toLowerCase().includes(search))
      : false
    return nameMatch || categoryMatch || labelMatch
  })

  const selectedVoice = voices.find((v) => v.voice_id === selectedVoiceId)

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

      {/* Voice Template selector */}
      {elevenLabsVoiceTemplates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-muted">Template de voz</span>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <BookMarked className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-bg py-1.5 pl-7 pr-8 text-xs text-text outline-none transition-colors focus:border-primary"
              >
                <option value="">Nenhum (manual)</option>
                {elevenLabsVoiceTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} -- {t.voiceName}
                  </option>
                ))}
              </select>
            </div>
            {selectedTemplateId && (
              <button
                type="button"
                onClick={() => handleDeleteTemplate(selectedTemplateId)}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-red-500/30 hover:text-red-400"
                title="Remover template"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Config row: Voice + Model */}
      <div className="grid grid-cols-2 gap-3">
        {/* Voice selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Voz</span>

          {loadingVoices ? (
            <div className="flex h-[34px] items-center gap-2 rounded-lg border border-border bg-bg px-2.5">
              <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
              <span className="text-xs text-text-muted">Carregando vozes...</span>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.value)}
                  placeholder={selectedVoice ? selectedVoice.name : 'Buscar voz...'}
                  className="w-full rounded-lg border border-border bg-bg py-1.5 pl-7 pr-2.5 text-xs text-text outline-none transition-colors focus:border-primary"
                />
              </div>
              {voiceSearch.trim() && (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                  {filteredVoices.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-text-muted">Nenhuma voz encontrada</div>
                  ) : (
                    filteredVoices.map((v) => (
                      <button
                        key={v.voice_id}
                        type="button"
                        onClick={() => {
                          setSelectedVoiceId(v.voice_id)
                          setVoiceSearch('')
                          setSelectedTemplateId('')
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-bg ${
                          v.voice_id === selectedVoiceId ? 'bg-primary/10 text-primary' : 'text-text'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{v.name}</span>
                          {v.category && (
                            <span className="text-[10px] text-text-muted">{v.category}</span>
                          )}
                        </div>
                        {v.preview_url && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreviewVoice(v)
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text"
                          >
                            {previewPlaying && previewVoiceId === v.voice_id ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Volume2 className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Selected voice chip */}
          {selectedVoice && !voiceSearch.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">
                {selectedVoice.name}
                {selectedVoice.category ? ` (${selectedVoice.category})` : ''}
              </span>
              {selectedVoice.preview_url && (
                <button
                  type="button"
                  onClick={() => handlePreviewVoice(selectedVoice)}
                  className="flex items-center gap-1 text-[10px] text-primary transition-colors hover:text-primary-light"
                >
                  {previewPlaying && previewVoiceId === selectedVoice.voice_id ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  Preview
                </button>
              )}
            </div>
          )}
        </div>

        {/* Model selector */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Modelo</span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
          >
            {ELEVENLABS_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Voice Settings (collapsible) */}
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setShowVoiceSettings(!showVoiceSettings)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs text-text-muted transition-colors hover:text-text"
        >
          <span>Voice Settings</span>
          {showVoiceSettings ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {showVoiceSettings && (
          <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-2">
            {/* Stability */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Stability</span>
                <span className="text-[11px] font-medium text-text">
                  {Math.round(voiceSettings.stability * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted/60">Variable</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(voiceSettings.stability * 100)}
                  onChange={(e) =>
                    setVoiceSettings((s) => ({ ...s, stability: Number(e.target.value) / 100 }))
                  }
                  className="flex-1 accent-primary"
                />
                <span className="text-[10px] text-text-muted/60">Stable</span>
              </div>
            </div>

            {/* Similarity */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Similarity</span>
                <span className="text-[11px] font-medium text-text">
                  {Math.round(voiceSettings.similarity_boost * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted/60">Low</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(voiceSettings.similarity_boost * 100)}
                  onChange={(e) =>
                    setVoiceSettings((s) => ({
                      ...s,
                      similarity_boost: Number(e.target.value) / 100
                    }))
                  }
                  className="flex-1 accent-primary"
                />
                <span className="text-[10px] text-text-muted/60">High</span>
              </div>
            </div>

            {/* Style Exaggeration */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Style Exaggeration</span>
                <span className="text-[11px] font-medium text-text">
                  {Math.round(voiceSettings.style * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-muted/60">None</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(voiceSettings.style * 100)}
                  onChange={(e) =>
                    setVoiceSettings((s) => ({ ...s, style: Number(e.target.value) / 100 }))
                  }
                  className="flex-1 accent-primary"
                />
                <span className="text-[10px] text-text-muted/60">Exaggerated</span>
              </div>
            </div>

            {/* Speaker Boost */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={voiceSettings.use_speaker_boost}
                onChange={(e) =>
                  setVoiceSettings((s) => ({ ...s, use_speaker_boost: e.target.checked }))
                }
                className="h-3.5 w-3.5 rounded border-border bg-bg accent-primary"
              />
              <span className="text-xs text-text-muted">Speaker Boost</span>
            </label>
          </div>
        )}
      </div>

      {/* Save as template */}
      <div className="flex items-center gap-2">
        {showSaveTemplate ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
              placeholder="Nome do template..."
              autoFocus
              className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim()}
              className="flex h-[30px] items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-medium text-white transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40"
            >
              <Save className="h-3 w-3" />
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSaveTemplate(false)
                setNewTemplateName('')
              }}
              className="text-[11px] text-text-muted transition-colors hover:text-text"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSaveTemplate(true)}
            disabled={!selectedVoiceId}
            className="flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-primary disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            Salvar como template
          </button>
        )}
      </div>

      {/* With transcript toggle */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={withTranscript}
          onChange={(e) => setWithTranscript(e.target.checked)}
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
          disabled={storyBlocks.length === 0 || !selectedVoiceId}
          onClick={handleGenerate}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          Gerar Audio Unico
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

      {/* Error state (all blocks failed) */}
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
          {/* Audio player */}
          <audio
            controls
            src={`file://${generatedAudio.localPath.replace(/\\/g, '/')}`}
            className="w-full"
          />
          </div>
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
