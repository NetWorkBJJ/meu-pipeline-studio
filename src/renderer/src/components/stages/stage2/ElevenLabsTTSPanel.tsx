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
import type {
  Ai33ElevenLabsVoice,
  Ai33TaskResponse,
  Ai33TaskCreatedResponse,
  Ai33TTSMetadata,
  Ai33CreditsResponse,
  Ai33VoicesResponse,
  Ai33TaskProgressEvent,
  ElevenLabsVoiceSettings,
  ElevenLabsVoiceTemplate
} from '@/types/ai33'
import { ELEVENLABS_MODELS } from '@/types/ai33'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type PanelPhase = 'idle' | 'generating' | 'polling' | 'downloading' | 'done' | 'error'

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

  // Generation state
  const [phase, setPhase] = useState<PanelPhase>('idle')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [pollProgress, setPollProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [creditCost, setCreditCost] = useState<number | null>(null)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)

  // Result
  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null)
  const [audioDurationMs, setAudioDurationMs] = useState<number | null>(null)

  // Audio preview
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null)

  // Result audio player
  const resultAudioRef = useRef<HTMLAudioElement | null>(null)

  // Polling ref to track cancellation
  const pollingRef = useRef(false)

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

  // Subscribe to ai33 task progress events
  useEffect(() => {
    const unsubscribe = window.api.onAi33TaskProgress((data) => {
      const evt = data as Ai33TaskProgressEvent
      if (taskId && evt.taskId === taskId) {
        setPollProgress(evt.progress)
      }
    })
    return unsubscribe
  }, [taskId])

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

      // If already playing this voice, stop it
      if (previewPlaying && previewVoiceId === voice.voice_id) {
        if (previewAudioRef.current) {
          previewAudioRef.current.pause()
          previewAudioRef.current.currentTime = 0
        }
        setPreviewPlaying(false)
        setPreviewVoiceId(null)
        return
      }

      // Stop any existing preview
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
  // Generate TTS
  // -----------------------------------------------------------------------

  const handleGenerate = async (): Promise<void> => {
    if (!editableText.trim()) {
      addToast({ type: 'warning', message: 'Insira texto para gerar audio.' })
      return
    }
    if (!selectedVoiceId) {
      addToast({ type: 'warning', message: 'Selecione uma voz.' })
      return
    }

    setPhase('generating')
    setErrorMessage(null)
    setCreditCost(null)
    setRemainingCredits(null)
    setLocalAudioPath(null)
    setAudioDurationMs(null)
    setPollProgress(0)

    try {
      // Step 1: Submit TTS task
      const createRes = (await window.api.ai33TtsElevenlabs({
        voiceId: selectedVoiceId,
        text: editableText,
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
        throw new Error('Falha ao criar task de TTS.')
      }

      const newTaskId = createRes.task_id
      setTaskId(newTaskId)
      setRemainingCredits(createRes.ec_remain_credits)
      setPhase('polling')

      // Step 2: Poll for completion
      pollingRef.current = true
      let taskResult: Ai33TaskResponse | null = null

      while (pollingRef.current) {
        await delay(2000)
        if (!pollingRef.current) break

        const pollRes = (await window.api.ai33PollTask(newTaskId)) as Ai33TaskResponse
        setPollProgress(pollRes.progress)

        if (pollRes.status === 'done') {
          taskResult = pollRes
          break
        }

        if (pollRes.status === 'error') {
          throw new Error(pollRes.error_message || 'Erro no processamento do audio.')
        }
      }

      if (!taskResult) {
        // Polling was cancelled
        setPhase('idle')
        return
      }

      setCreditCost(taskResult.credit_cost)

      // Step 3: Download audio
      setPhase('downloading')
      const metadata = taskResult.metadata as Ai33TTSMetadata

      if (!metadata.audio_url) {
        throw new Error('Resposta sem URL de audio.')
      }

      const downloadRes = await window.api.ai33DownloadFile({
        url: metadata.audio_url,
        fileName: `elevenlabs_tts_${Date.now()}.mp3`
      })

      const dlResult = downloadRes as { success: boolean; localPath: string; size: number }

      if (!dlResult.success) {
        throw new Error('Falha ao baixar o arquivo de audio.')
      }

      setLocalAudioPath(dlResult.localPath)
      setPhase('done')

      // Refresh credits after generation
      loadCredits()

      addToast({ type: 'success', message: 'Audio gerado com sucesso via ElevenLabs.' })
    } catch (err) {
      setPhase('error')
      const msg = err instanceof Error ? err.message : 'Erro ao gerar audio.'
      setErrorMessage(msg)
      addToast({ type: 'error', message: msg })
    } finally {
      pollingRef.current = false
    }
  }

  // -----------------------------------------------------------------------
  // Detect audio duration from the result audio element
  // -----------------------------------------------------------------------

  const handleAudioLoaded = (): void => {
    if (resultAudioRef.current && resultAudioRef.current.duration) {
      setAudioDurationMs(Math.round(resultAudioRef.current.duration * 1000))
    }
  }

  // -----------------------------------------------------------------------
  // Confirm: create AudioBlocks and advance pipeline
  // -----------------------------------------------------------------------

  const handleConfirm = (): void => {
    if (!localAudioPath || audioDurationMs === null) {
      addToast({ type: 'warning', message: 'Aguarde o audio carregar.' })
      return
    }

    const audioBlocks = [
      {
        id: uuidv4(),
        index: 1,
        filePath: localAudioPath,
        startMs: 0,
        endMs: audioDurationMs,
        durationMs: audioDurationMs,
        linkedBlockId: null,
        source: 'tts' as const
      }
    ]

    setAudioBlocks(audioBlocks)
    completeStage(2)
    addToast({ type: 'success', message: 'Etapa 2 concluida.' })
    setTimeout(() => setCurrentStage(3), 400)
  }

  // -----------------------------------------------------------------------
  // Reset to try again
  // -----------------------------------------------------------------------

  const handleRefazer = (): void => {
    pollingRef.current = false
    setPhase('idle')
    setTaskId(null)
    setPollProgress(0)
    setErrorMessage(null)
    setCreditCost(null)
    setRemainingCredits(null)
    setLocalAudioPath(null)
    setAudioDurationMs(null)
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

  const hasText = editableText.trim().length > 0
  const isWorking = phase === 'generating' || phase === 'polling' || phase === 'downloading'

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

      {/* Text area */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Texto para narracao</span>
          <span className="text-[10px] text-text-muted/70">{editableText.length} caracteres</span>
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
      {phase === 'idle' && (
        <button
          type="button"
          disabled={!hasText || !selectedVoiceId}
          onClick={handleGenerate}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          Gerar Audio (ElevenLabs)
        </button>
      )}

      {/* Progress during generation/polling/downloading */}
      {isWorking && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-text">
              {phase === 'generating' && 'Enviando para ElevenLabs...'}
              {phase === 'polling' && 'Processando audio...'}
              {phase === 'downloading' && 'Baixando audio...'}
            </span>
          </div>

          {/* Progress bar */}
          {phase === 'polling' && (
            <div className="flex flex-col gap-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(pollProgress, 5)}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted">{pollProgress}% concluido</span>
            </div>
          )}

          {taskId && (
            <span className="text-[10px] font-mono text-text-muted/60">Task: {taskId}</span>
          )}
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
      {phase === 'done' && localAudioPath && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <h4 className="text-sm font-medium text-text">Audio gerado</h4>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {audioDurationMs !== null && (
                  <span className="text-xs text-text-muted">
                    Duracao: {msToDisplay(audioDurationMs)}
                  </span>
                )}
                {creditCost !== null && (
                  <span className="text-xs text-text-muted">
                    Custo: {creditCost.toFixed(2)} creditos
                  </span>
                )}
                {remainingCredits !== null && (
                  <span className="text-xs text-text-muted">
                    Restante: {remainingCredits.toFixed(2)}
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
                disabled={audioDurationMs === null}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirmar audio
              </button>
            </div>
          </div>

          {/* Audio player */}
          <audio
            ref={resultAudioRef}
            controls
            onLoadedMetadata={handleAudioLoaded}
            src={`file://${localAudioPath.replace(/\\/g, '/')}`}
            className="w-full"
          />

          {/* File path */}
          <span className="break-all text-[10px] font-mono text-text-muted/50">
            {localAudioPath}
          </span>
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
