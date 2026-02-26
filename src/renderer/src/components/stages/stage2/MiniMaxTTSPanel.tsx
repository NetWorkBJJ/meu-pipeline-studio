import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Volume2,
  Search,
  ChevronDown,
  ChevronUp,
  Coins
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import type {
  Ai33MiniMaxVoiceItem,
  Ai33ClonedVoice,
  Ai33TaskResponse,
  Ai33TaskCreatedResponse,
  Ai33MiniMaxTTSMetadata,
  Ai33CreditsResponse,
  Ai33MiniMaxVoiceListResponse,
  Ai33ClonedVoicesListResponse,
  Ai33DownloadResult
} from '@/types/ai33'
import { MINIMAX_MODELS, LANGUAGE_BOOST_OPTIONS } from '@/types/ai33'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type PanelPhase = 'config' | 'generating' | 'result'

interface VoiceOption {
  id: string
  name: string
  source: 'catalog' | 'cloned'
  previewUrl?: string
  language?: string
  gender?: string
  tags?: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MiniMaxTTSPanel(): React.JSX.Element {
  const { storyBlocks, setAudioBlocks } = useProjectStore()
  const { completeStage, setCurrentStage } = useStageStore()
  const { addToast } = useUIStore()

  // -- API key check --
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [credits, setCredits] = useState<number | null>(null)

  // -- Voice list --
  const [catalogVoices, setCatalogVoices] = useState<VoiceOption[]>([])
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false)

  // -- Config state --
  const [selectedVoiceId, setSelectedVoiceId] = useState('')
  const [selectedVoiceName, setSelectedVoiceName] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>(MINIMAX_MODELS[0].id)
  const [languageBoost, setLanguageBoost] = useState('pt')
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(1.0)
  const [withTranscript, setWithTranscript] = useState(true)
  const [editableText, setEditableText] = useState('')

  // -- Generation state --
  const [phase, setPhase] = useState<PanelPhase>('config')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [pollProgress, setPollProgress] = useState(0)
  const [pollStatus, setPollStatus] = useState('')
  const [creditCost, setCreditCost] = useState<number | null>(null)

  // -- Result state --
  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null)
  const [audioDurationMs, setAudioDurationMs] = useState(0)

  // -- Preview --
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const resultAudioRef = useRef<HTMLAudioElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // ---------------------------------------------------------------------------
  // Init: check API key, fetch credits, load voices
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    const init = async (): Promise<void> => {
      try {
        const keyOk = await window.api.ai33HasApiKey()
        if (cancelled) return
        setHasKey(keyOk)

        if (keyOk) {
          const cr = (await window.api.ai33GetCredits()) as Ai33CreditsResponse
          if (!cancelled && cr.success) setCredits(cr.credits)
        }
      } catch {
        if (!cancelled) setHasKey(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  // Load voices when key is confirmed
  useEffect(() => {
    if (hasKey !== true) return
    let cancelled = false

    const loadVoices = async (): Promise<void> => {
      setVoicesLoading(true)
      try {
        // Fetch catalog voices (first page, large batch)
        const catalogRes = (await window.api.ai33MinimaxVoiceList({
          page: 1,
          page_size: 100
        })) as Ai33MiniMaxVoiceListResponse

        if (!cancelled && catalogRes.success && catalogRes.data) {
          const mapped: VoiceOption[] = catalogRes.data.voice_list.map((v: Ai33MiniMaxVoiceItem) => ({
            id: v.voice_id || '',
            name: v.name || v.voice_id || 'Unknown',
            source: 'catalog' as const,
            previewUrl: v.preview_url || v.sample_url,
            language: v.language,
            gender: v.gender,
            tags: v.tags
          }))
          setCatalogVoices(mapped)

          // Auto-select first voice if none selected
          if (!selectedVoiceId && mapped.length > 0) {
            setSelectedVoiceId(mapped[0].id)
            setSelectedVoiceName(mapped[0].name)
          }
        }

        // Fetch cloned voices
        const clonedRes = (await window.api.ai33MinimaxClonedVoices()) as Ai33ClonedVoicesListResponse
        if (!cancelled && clonedRes.success && clonedRes.data) {
          const mapped: VoiceOption[] = clonedRes.data.map((v: Ai33ClonedVoice) => ({
            id: v.voice_id,
            name: v.voice_name || v.voice_id,
            source: 'cloned' as const,
            previewUrl: v.sample_audio,
            tags: v.tag_list
          }))
          setClonedVoices(mapped)
        }
      } catch (err) {
        if (!cancelled) {
          addToast({
            type: 'error',
            message: err instanceof Error ? err.message : 'Falha ao carregar vozes MiniMax.'
          })
        }
      } finally {
        if (!cancelled) setVoicesLoading(false)
      }
    }

    loadVoices()
    return () => {
      cancelled = true
    }
  }, [hasKey, addToast, selectedVoiceId])

  // Populate text from storyBlocks
  useEffect(() => {
    if (storyBlocks.length > 0 && !editableText) {
      setEditableText(storyBlocks.map((b) => b.text).join('\n\n'))
    }
  }, [storyBlocks, editableText])

  // Subscribe to task progress events
  useEffect(() => {
    const unsubscribe = window.api.onAi33TaskProgress((raw: unknown) => {
      const evt = raw as { taskId: string; progress: number; status: string }
      if (taskId && evt.taskId === taskId) {
        setPollProgress(evt.progress)
        setPollStatus(evt.status)
      }
    })
    return unsubscribe
  }, [taskId])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setVoiceDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ---------------------------------------------------------------------------
  // Voice selection helpers
  // ---------------------------------------------------------------------------

  const allVoices: VoiceOption[] = [...clonedVoices, ...catalogVoices]

  const filteredVoices = allVoices.filter((v) => {
    if (!voiceSearch.trim()) return true
    const q = voiceSearch.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.language?.toLowerCase().includes(q) ||
      v.gender?.toLowerCase().includes(q) ||
      v.tags?.some((t) => t.toLowerCase().includes(q))
    )
  })

  const filteredCatalog = filteredVoices.filter((v) => v.source === 'catalog')
  const filteredCloned = filteredVoices.filter((v) => v.source === 'cloned')

  const handleSelectVoice = useCallback((voice: VoiceOption) => {
    setSelectedVoiceId(voice.id)
    setSelectedVoiceName(voice.name)
    setVoiceDropdownOpen(false)
    setVoiceSearch('')
  }, [])

  const handlePreviewVoice = useCallback(
    (voice: VoiceOption, e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      if (!voice.previewUrl) return

      if (previewVoiceId === voice.id && previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current.currentTime = 0
        setPreviewVoiceId(null)
        return
      }

      setPreviewVoiceId(voice.id)
      if (previewAudioRef.current) {
        previewAudioRef.current.src = voice.previewUrl
        previewAudioRef.current.play().catch(() => {
          /* ignore autoplay block */
        })
      }
    },
    [previewVoiceId]
  )

  // ---------------------------------------------------------------------------
  // Generate handler
  // ---------------------------------------------------------------------------

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
    setPollProgress(0)
    setPollStatus('Enviando para MiniMax...')
    setTaskId(null)
    setCreditCost(null)
    setLocalAudioPath(null)
    setAudioDurationMs(0)

    try {
      // 1. Create the TTS task
      const createRes = (await window.api.ai33TtsMinimax({
        text: editableText,
        model: selectedModel,
        voice_setting: {
          voice_id: selectedVoiceId,
          vol: volume,
          pitch,
          speed
        },
        language_boost: languageBoost || undefined,
        with_transcript: withTranscript
      })) as Ai33TaskCreatedResponse

      if (!createRes.success || !createRes.task_id) {
        throw new Error('Falha ao criar tarefa de TTS no MiniMax.')
      }

      setTaskId(createRes.task_id)
      setPollStatus('Processando...')

      // Update remaining credits if returned
      if (typeof createRes.ec_remain_credits === 'number') {
        setCredits(createRes.ec_remain_credits)
      }

      // 2. Poll until complete
      let task: Ai33TaskResponse | null = null
      let attempts = 0
      const MAX_ATTEMPTS = 120 // ~2 minutes with 1s intervals

      while (attempts < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000))
        attempts++

        const pollRes = (await window.api.ai33PollTask(createRes.task_id)) as Ai33TaskResponse
        setPollProgress(pollRes.progress ?? Math.min(attempts / MAX_ATTEMPTS * 100, 95))
        setPollStatus(
          pollRes.status === 'doing'
            ? `Processando... ${Math.round(pollRes.progress ?? 0)}%`
            : pollRes.status === 'done'
              ? 'Concluido!'
              : pollRes.status === 'error'
                ? `Erro: ${pollRes.error_message || 'desconhecido'}`
                : `Status: ${pollRes.status}`
        )

        if (pollRes.status === 'done') {
          task = pollRes
          break
        }

        if (pollRes.status === 'error') {
          throw new Error(pollRes.error_message || 'Tarefa falhou no servidor.')
        }
      }

      if (!task) {
        throw new Error('Timeout: tarefa demorou mais de 2 minutos.')
      }

      setCreditCost(task.credit_cost ?? null)

      // 3. Download audio
      const metadata = task.metadata as Ai33MiniMaxTTSMetadata
      if (!metadata?.audio_url) {
        throw new Error('Servidor retornou tarefa sem URL de audio.')
      }

      setPollStatus('Baixando audio...')

      const dlRes = (await window.api.ai33DownloadFile({
        url: metadata.audio_url,
        fileName: `minimax_tts_${Date.now()}.mp3`
      })) as Ai33DownloadResult

      if (!dlRes.success || !dlRes.localPath) {
        throw new Error('Falha ao baixar arquivo de audio.')
      }

      setLocalAudioPath(dlRes.localPath)
      setPollProgress(100)
      setPollStatus('Audio pronto!')
      setPhase('result')

      addToast({
        type: 'success',
        message: 'Audio MiniMax gerado com sucesso.'
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar audio MiniMax.'
      addToast({ type: 'error', message: msg })
      setPhase('config')
    }
  }

  // ---------------------------------------------------------------------------
  // Audio duration detection
  // ---------------------------------------------------------------------------

  const handleAudioLoaded = useCallback(() => {
    if (resultAudioRef.current && resultAudioRef.current.duration) {
      setAudioDurationMs(Math.round(resultAudioRef.current.duration * 1000))
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Confirm (create audio blocks and advance pipeline)
  // ---------------------------------------------------------------------------

  const handleConfirm = (): void => {
    if (!localAudioPath || audioDurationMs <= 0) {
      addToast({ type: 'warning', message: 'Aguarde o audio carregar completamente.' })
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

  // ---------------------------------------------------------------------------
  // Reset to try again
  // ---------------------------------------------------------------------------

  const handleRefazer = (): void => {
    setPhase('config')
    setTaskId(null)
    setPollProgress(0)
    setPollStatus('')
    setCreditCost(null)
    setLocalAudioPath(null)
    setAudioDurationMs(0)
  }

  // ---------------------------------------------------------------------------
  // Render: No API key warning
  // ---------------------------------------------------------------------------

  if (hasKey === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-muted">Verificando API key...</span>
      </div>
    )
  }

  if (hasKey === false) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <h3 className="text-sm font-medium text-text">API Key ai33.pro nao configurada</h3>
        <p className="text-center text-xs leading-relaxed text-text-muted">
          Configure sua API key do ai33.pro nas configuracoes do app para usar o TTS MiniMax.
        </p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Voice item
  // ---------------------------------------------------------------------------

  const renderVoiceItem = (voice: VoiceOption): React.JSX.Element => {
    const isSelected = voice.id === selectedVoiceId
    return (
      <button
        key={voice.id}
        type="button"
        onClick={() => handleSelectVoice(voice)}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
          isSelected
            ? 'bg-primary/15 text-primary-light'
            : 'text-text hover:bg-surface-hover'
        }`}
      >
        <span className="flex-1 truncate">{voice.name}</span>
        {voice.language && (
          <span className="shrink-0 text-[10px] text-text-muted">{voice.language}</span>
        )}
        {voice.gender && (
          <span className="shrink-0 text-[10px] text-text-muted">{voice.gender}</span>
        )}
        {voice.previewUrl && (
          <button
            type="button"
            onClick={(e) => handlePreviewVoice(voice, e)}
            className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:text-primary"
            title="Pre-visualizar voz"
          >
            <Volume2 className={`h-3 w-3 ${previewVoiceId === voice.id ? 'text-primary' : ''}`} />
          </button>
        )}
      </button>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Config phase
  // ---------------------------------------------------------------------------

  const renderConfig = (): React.JSX.Element => (
    <div className="flex flex-col gap-4">
      {/* Credits */}
      {credits !== null && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Coins className="h-3.5 w-3.5" />
          <span>Creditos disponiveis: <strong className="text-text">{credits.toFixed(2)}</strong></span>
        </div>
      )}

      {/* Row 1: Voice selector + Model + Language */}
      <div className="grid grid-cols-3 gap-3">
        {/* Voice dropdown */}
        <div className="relative flex flex-col gap-1" ref={dropdownRef}>
          <span className="text-[11px] text-text-muted">Voz MiniMax</span>
          <button
            type="button"
            onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
            disabled={voicesLoading}
            className="flex h-[30px] items-center justify-between rounded-lg border border-border bg-bg px-2.5 text-xs text-text outline-none transition-colors focus:border-primary disabled:opacity-50"
          >
            {voicesLoading ? (
              <span className="flex items-center gap-1.5 text-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando...
              </span>
            ) : (
              <span className="truncate">{selectedVoiceName || 'Selecionar...'}</span>
            )}
            {voiceDropdownOpen ? (
              <ChevronUp className="h-3 w-3 shrink-0 text-text-muted" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0 text-text-muted" />
            )}
          </button>

          {voiceDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
              {/* Search */}
              <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
                <Search className="h-3 w-3 text-text-muted" />
                <input
                  type="text"
                  value={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.value)}
                  placeholder="Buscar vozes..."
                  className="flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text-muted"
                  autoFocus
                />
              </div>

              <div className="max-h-52 overflow-y-auto p-1">
                {/* Cloned voices section */}
                {filteredCloned.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Vozes clonadas
                    </div>
                    {filteredCloned.map(renderVoiceItem)}
                  </>
                )}

                {/* Catalog voices section */}
                {filteredCatalog.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Catalogo
                    </div>
                    {filteredCatalog.map(renderVoiceItem)}
                  </>
                )}

                {filteredVoices.length === 0 && (
                  <div className="px-2 py-3 text-center text-xs text-text-muted">
                    Nenhuma voz encontrada.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Model */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Modelo</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="h-[30px] rounded-lg border border-border bg-bg px-2.5 text-xs text-text outline-none transition-colors focus:border-primary"
          >
            {MINIMAX_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Language boost */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Language Boost</span>
          <select
            value={languageBoost}
            onChange={(e) => setLanguageBoost(e.target.value)}
            className="h-[30px] rounded-lg border border-border bg-bg px-2.5 text-xs text-text outline-none transition-colors focus:border-primary"
          >
            {LANGUAGE_BOOST_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Voice controls */}
      <div className="grid grid-cols-3 gap-3">
        {/* Speed */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted">Velocidade</span>
            <span className="text-[10px] font-mono text-text-muted">{speed.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
        </div>

        {/* Pitch */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted">Tom (pitch)</span>
            <span className="text-[10px] font-mono text-text-muted">{pitch > 0 ? '+' : ''}{pitch}</span>
          </div>
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={pitch}
            onChange={(e) => setPitch(parseInt(e.target.value, 10))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
        </div>

        {/* Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-muted">Volume</span>
            <span className="text-[10px] font-mono text-text-muted">{volume.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
        </div>
      </div>

      {/* With transcript toggle */}
      <label className="flex items-center gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={withTranscript}
          onChange={(e) => setWithTranscript(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-border bg-bg accent-primary"
        />
        Gerar transcricao (SRT) junto com o audio
      </label>

      {/* Text editor */}
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
      <button
        type="button"
        disabled={!editableText.trim() || !selectedVoiceId}
        onClick={handleGenerate}
        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play className="h-4 w-4" />
        Gerar Audio (MiniMax)
      </button>

      {/* Hidden audio for voice preview */}
      <audio
        ref={previewAudioRef}
        className="hidden"
        onEnded={() => setPreviewVoiceId(null)}
      />
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render: Generating phase
  // ---------------------------------------------------------------------------

  const renderGenerating = (): React.JSX.Element => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <h4 className="text-sm font-medium text-text">Gerando audio com MiniMax</h4>
        <p className="text-xs text-text-muted">{pollStatus || 'Aguardando...'}</p>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Progresso</span>
            <span>{Math.round(pollProgress)}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pollProgress}%` }}
            />
          </div>
        </div>

        {taskId && (
          <span className="text-[10px] font-mono text-text-muted/50">Task: {taskId}</span>
        )}
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render: Result phase
  // ---------------------------------------------------------------------------

  const renderResult = (): React.JSX.Element => (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <div>
            <h4 className="text-sm font-medium text-text">Audio gerado</h4>
            <p className="text-xs text-text-muted">
              {audioDurationMs > 0
                ? `Duracao: ${formatSeconds(audioDurationMs / 1000)}`
                : 'Carregando duracao...'}
              {creditCost !== null && ` | Custo: ${creditCost} creditos`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefazer}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted transition-all duration-150 hover:bg-surface-hover hover:text-text active:scale-[0.98]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refazer
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={audioDurationMs <= 0}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar audio
          </button>
        </div>
      </div>

      {/* Audio player */}
      {localAudioPath && (
        <audio
          ref={resultAudioRef}
          controls
          src={`file://${localAudioPath.replace(/\\/g, '/')}`}
          onLoadedMetadata={handleAudioLoaded}
          className="w-full"
        />
      )}

      {/* Voice info */}
      <div className="flex flex-wrap gap-2 text-[10px] text-text-muted">
        <span>Voz: {selectedVoiceName}</span>
        <span>|</span>
        <span>
          Modelo: {MINIMAX_MODELS.find((m) => m.id === selectedModel)?.label || selectedModel}
        </span>
        <span>|</span>
        <span>
          Idioma: {LANGUAGE_BOOST_OPTIONS.find((o) => o.value === languageBoost)?.label || 'Auto'}
        </span>
        <span>|</span>
        <span>Vel: {speed.toFixed(1)}x</span>
        <span>|</span>
        <span>Tom: {pitch > 0 ? '+' : ''}{pitch}</span>
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {phase === 'config' && renderConfig()}
      {phase === 'generating' && renderGenerating()}
      {phase === 'result' && renderResult()}
    </div>
  )
}
