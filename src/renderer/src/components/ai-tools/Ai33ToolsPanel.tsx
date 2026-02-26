import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Languages,
  FileText,
  Wand2,
  UserCog,
  Filter,
  Music,
  Image,
  Upload,
  Loader2,
  Download,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  Coins
} from 'lucide-react'
import { Input } from '@/components/shared/Input'
import { TextArea } from '@/components/shared/TextArea'
import { Select } from '@/components/shared/Select'
import { Button } from '@/components/shared/Button'
import { ProgressBar } from '@/components/shared/ProgressBar'
import type {
  Ai33TaskResponse,
  Ai33ClonedVoice,
  Ai33ImageModel,
  Ai33TaskCreatedResponse,
  Ai33VoiceCloneResponse,
  Ai33ClonedVoicesListResponse,
  Ai33ImageModelsResponse,
  Ai33ImagePriceResponse,
  Ai33ImageGenerateResponse,
  Ai33CreditsResponse,
  Ai33DownloadResult,
  Ai33VoiceChangerResponse,
  Ai33DubbingMetadata,
  Ai33STTMetadata,
  Ai33SoundEffectMetadata,
  Ai33VoiceChangerMetadata,
  Ai33VoiceIsolateMetadata,
  Ai33MusicMetadata,
  Ai33ImageMetadata,
  Ai33ElevenLabsVoice,
  Ai33VoicesResponse
} from '@/types/ai33'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolId =
  | 'voice-clone'
  | 'dubbing'
  | 'stt'
  | 'sound-effect'
  | 'voice-changer'
  | 'voice-isolate'
  | 'music'
  | 'image'

interface ToolDef {
  id: ToolId
  label: string
  icon: React.ElementType
  description: string
}

interface TaskState {
  taskId: string | null
  status: 'idle' | 'submitting' | 'polling' | 'done' | 'error'
  progress: number
  result: Ai33TaskResponse | null
  errorMessage: string | null
  creditCost: number | null
  downloadedPath: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOLS: ToolDef[] = [
  { id: 'voice-clone', label: 'Voice Clone', icon: Mic, description: 'Clone uma voz a partir de amostra de audio' },
  { id: 'dubbing', label: 'Dubbing', icon: Languages, description: 'Duble audio/video para outro idioma' },
  { id: 'stt', label: 'Speech-to-Text', icon: FileText, description: 'Transcreva audio em texto e SRT' },
  { id: 'sound-effect', label: 'Sound Effects', icon: Wand2, description: 'Gere efeitos sonoros por descricao' },
  { id: 'voice-changer', label: 'Voice Changer', icon: UserCog, description: 'Altere a voz de um audio existente' },
  { id: 'voice-isolate', label: 'Voice Isolate', icon: Filter, description: 'Isole a voz removendo fundo' },
  { id: 'music', label: 'Music Generation', icon: Music, description: 'Gere musica a partir de uma ideia' },
  { id: 'image', label: 'Image Generation', icon: Image, description: 'Gere imagens com IA por prompt' }
]

const LANGUAGE_OPTIONS = [
  { value: 'pt', label: 'Portugues' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Espanhol' },
  { value: 'fr', label: 'Frances' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: 'Japones' },
  { value: 'ko', label: 'Coreano' },
  { value: 'zh', label: 'Chines' },
  { value: 'ru', label: 'Russo' },
  { value: 'ar', label: 'Arabe' }
]

const CLONE_LANGUAGE_OPTIONS = [
  { value: 'pt-BR', label: 'Portugues (BR)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Espanhol' },
  { value: 'fr-FR', label: 'Frances' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'ja-JP', label: 'Japones' },
  { value: 'ko-KR', label: 'Coreano' },
  { value: 'zh-CN', label: 'Chines' }
]

const GENDER_OPTIONS = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' }
]

const AUDIO_FILTERS = [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'webm'] }]
const VIDEO_FILTERS = [{ name: 'Audio/Video', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'mp4', 'mkv', 'webm', 'avi', 'mov'] }]
const IMAGE_FILTERS = [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]

const POLL_INTERVAL = 3000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initialTaskState(): TaskState {
  return {
    taskId: null,
    status: 'idle',
    progress: 0,
    result: null,
    errorMessage: null,
    creditCost: null,
    downloadedPath: null
  }
}

function fileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function FilePickerField({
  label,
  value,
  onPick,
  filters,
  multiple = false
}: {
  label: string
  value: string | string[]
  onPick: () => void
  filters: { name: string; extensions: string[] }[]
  multiple?: boolean
}): React.JSX.Element {
  const display = Array.isArray(value)
    ? value.length > 0
      ? value.map(fileName).join(', ')
      : ''
    : value
      ? fileName(value)
      : ''

  void filters
  void multiple

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-muted">
          {display || 'Nenhum arquivo selecionado'}
        </div>
        <Button variant="secondary" size="sm" onClick={onPick}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Selecionar
        </Button>
      </div>
    </div>
  )
}

function TaskStatusDisplay({ task, onDownload }: { task: TaskState; onDownload?: () => void }): React.JSX.Element | null {
  if (task.status === 'idle') return null

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-3">
      {task.status === 'submitting' && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Enviando...
        </div>
      )}

      {task.status === 'polling' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Processando... {task.progress > 0 ? `${Math.round(task.progress * 100)}%` : ''}
          </div>
          {task.progress > 0 && <ProgressBar value={task.progress * 100} />}
        </div>
      )}

      {task.status === 'done' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            Concluido
          </div>
          {task.creditCost !== null && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Coins className="h-3 w-3" />
              Custo: {task.creditCost} creditos
            </div>
          )}
          {task.downloadedPath && (
            <div className="text-xs text-text-muted">
              Salvo: {task.downloadedPath}
            </div>
          )}
          {onDownload && !task.downloadedPath && (
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Baixar resultado
            </Button>
          )}
        </div>
      )}

      {task.status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <X className="h-4 w-4" />
          {task.errorMessage ?? 'Erro desconhecido'}
        </div>
      )}
    </div>
  )
}

function AudioPlayer({ src }: { src: string }): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  const toggle = useCallback(() => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }, [playing])

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className="text-xs text-text-muted">{fileName(src)}</span>
    </div>
  )
}

function ToggleSwitch({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </div>
      <span className="text-xs text-text-muted">{label}</span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Hook: useTaskPoller
// ---------------------------------------------------------------------------

function useTaskPoller() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startPolling = useCallback(
    (taskId: string, onUpdate: (task: Ai33TaskResponse) => void, onDone: (task: Ai33TaskResponse) => void, onError: (msg: string) => void) => {
      if (intervalRef.current) clearInterval(intervalRef.current)

      intervalRef.current = setInterval(async () => {
        try {
          const result = (await window.api.ai33PollTask(taskId)) as Ai33TaskResponse
          onUpdate(result)

          if (result.status === 'done') {
            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = null
            onDone(result)
          } else if (result.status === 'error') {
            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = null
            onError(result.error_message ?? 'Task failed')
          }
        } catch (err) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          onError(err instanceof Error ? err.message : 'Polling failed')
        }
      }, POLL_INTERVAL)
    },
    []
  )

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  return { startPolling, stopPolling }
}

// ---------------------------------------------------------------------------
// Tool: Voice Clone
// ---------------------------------------------------------------------------

function VoiceCloneTool(): React.JSX.Element {
  const [filePath, setFilePath] = useState('')
  const [voiceName, setVoiceName] = useState('')
  const [languageTag, setLanguageTag] = useState('pt-BR')
  const [gender, setGender] = useState('male')
  const [noiseReduction, setNoiseReduction] = useState(true)
  const [clonedVoices, setClonedVoices] = useState<Ai33ClonedVoice[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadVoices = useCallback(async () => {
    setListLoading(true)
    try {
      const res = (await window.api.ai33MinimaxClonedVoices()) as Ai33ClonedVoicesListResponse
      if (res.success && res.data) {
        setClonedVoices(res.data)
      }
    } catch {
      // silent
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVoices()
  }, [loadVoices])

  const pickFile = useCallback(async () => {
    const files = await window.api.selectFiles(AUDIO_FILTERS)
    if (files.length > 0) setFilePath(files[0])
  }, [])

  const handleClone = useCallback(async () => {
    if (!filePath || !voiceName.trim()) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = (await window.api.ai33MinimaxVoiceClone({
        filePath,
        voice_name: voiceName.trim(),
        language_tag: languageTag,
        need_noise_reduction: noiseReduction,
        gender_tag: gender
      })) as Ai33VoiceCloneResponse

      if (res.success) {
        setSuccess(`Voz clonada com sucesso! ID: ${res.cloned_voice_id}`)
        setVoiceName('')
        setFilePath('')
        loadVoices()
      } else {
        setError('Falha ao clonar voz')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao clonar voz')
    } finally {
      setLoading(false)
    }
  }, [filePath, voiceName, languageTag, noiseReduction, gender, loadVoices])

  const handleDelete = useCallback(async (voiceId: string) => {
    try {
      await window.api.ai33MinimaxDeleteClone(voiceId)
      setClonedVoices((prev) => prev.filter((v) => v.voice_id !== voiceId))
    } catch {
      // silent
    }
  }, [])

  return (
    <div className="space-y-4">
      <FilePickerField label="Amostra de audio" value={filePath} onPick={pickFile} filters={AUDIO_FILTERS} />

      <Input label="Nome da voz" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} placeholder="Ex: Narrador principal" />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Idioma" options={CLONE_LANGUAGE_OPTIONS} value={languageTag} onChange={(e) => setLanguageTag(e.target.value)} />
        <Select label="Genero" options={GENDER_OPTIONS} value={gender} onChange={(e) => setGender(e.target.value)} />
      </div>

      <ToggleSwitch label="Reducao de ruido" checked={noiseReduction} onChange={setNoiseReduction} />

      <Button
        variant="primary"
        onClick={handleClone}
        disabled={loading || !filePath || !voiceName.trim()}
      >
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mic className="mr-1.5 h-4 w-4" />}
        Clonar voz
      </Button>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400">
          <Check className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {/* Cloned voices list */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-medium text-text-muted">Vozes clonadas</h4>
          <button
            type="button"
            onClick={loadVoices}
            disabled={listLoading}
            className="text-text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {clonedVoices.length === 0 ? (
          <p className="text-xs text-text-muted">Nenhuma voz clonada ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {clonedVoices.map((voice) => (
              <div
                key={voice.voice_id}
                className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2"
              >
                <div>
                  <span className="text-sm text-text">{voice.voice_name}</span>
                  <span className="ml-2 text-[11px] text-text-muted">{voice.voice_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  {voice.sample_audio && <AudioPlayer src={voice.sample_audio} />}
                  <button
                    type="button"
                    onClick={() => handleDelete(voice.voice_id)}
                    className="text-text-muted transition-colors hover:text-red-400"
                    title="Remover voz clonada"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Dubbing
// ---------------------------------------------------------------------------

function DubbingTool(): React.JSX.Element {
  const [filePath, setFilePath] = useState('')
  const [numSpeakers, setNumSpeakers] = useState('1')
  const [sourceLang, setSourceLang] = useState('pt')
  const [targetLang, setTargetLang] = useState('en')
  const [disableCloning, setDisableCloning] = useState(false)
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const { startPolling, stopPolling } = useTaskPoller()

  const pickFile = useCallback(async () => {
    const files = await window.api.selectFiles(VIDEO_FILTERS)
    if (files.length > 0) setFilePath(files[0])
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!filePath) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })

    try {
      const res = (await window.api.ai33Dubbing({
        filePath,
        num_speakers: parseInt(numSpeakers) || 1,
        disable_voice_cloning: disableCloning,
        source_lang: sourceLang,
        target_lang: targetLang
      })) as Ai33TaskCreatedResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({ ...prev, taskId: res.task_id, status: 'polling' }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [filePath, numSpeakers, disableCloning, sourceLang, targetLang, startPolling, stopPolling])

  const handleDownload = useCallback(async () => {
    if (!task.result?.metadata) return
    const meta = task.result.metadata as Ai33DubbingMetadata
    if (meta.audio_url) {
      try {
        const res = (await window.api.ai33DownloadFile({ url: meta.audio_url })) as Ai33DownloadResult
        if (res.success) {
          setTask((prev) => ({ ...prev, downloadedPath: res.localPath }))
        }
      } catch {
        // silent
      }
    }
  }, [task.result])

  return (
    <div className="space-y-4">
      <FilePickerField label="Arquivo de audio/video" value={filePath} onPick={pickFile} filters={VIDEO_FILTERS} />

      <Input
        label="Numero de speakers"
        type="number"
        min={1}
        max={10}
        value={numSpeakers}
        onChange={(e) => setNumSpeakers(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Idioma de origem" options={LANGUAGE_OPTIONS} value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} />
        <Select label="Idioma de destino" options={LANGUAGE_OPTIONS} value={targetLang} onChange={(e) => setTargetLang(e.target.value)} />
      </div>

      <ToggleSwitch label="Desativar clonagem de voz" checked={disableCloning} onChange={setDisableCloning} />

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!filePath || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Languages className="mr-1.5 h-4 w-4" />
        )}
        Dublar
      </Button>

      <TaskStatusDisplay task={task} onDownload={handleDownload} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Speech-to-Text
// ---------------------------------------------------------------------------

function SpeechToTextTool(): React.JSX.Element {
  const [filePath, setFilePath] = useState('')
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const [transcription, setTranscription] = useState<string | null>(null)
  const { startPolling, stopPolling } = useTaskPoller()

  const pickFile = useCallback(async () => {
    const files = await window.api.selectFiles(AUDIO_FILTERS)
    if (files.length > 0) setFilePath(files[0])
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!filePath) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })
    setTranscription(null)

    try {
      const res = (await window.api.ai33SpeechToText(filePath)) as Ai33TaskCreatedResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({ ...prev, taskId: res.task_id, status: 'polling' }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [filePath, startPolling, stopPolling])

  const handleDownloadSrt = useCallback(async () => {
    if (!task.result?.metadata) return
    const meta = task.result.metadata as Ai33STTMetadata
    if (meta.srt_url) {
      try {
        const res = (await window.api.ai33DownloadFile({ url: meta.srt_url, fileName: 'transcription.srt' })) as Ai33DownloadResult
        if (res.success) {
          setTask((prev) => ({ ...prev, downloadedPath: res.localPath }))
        }
      } catch {
        // silent
      }
    }
  }, [task.result])

  const handleDownloadJson = useCallback(async () => {
    if (!task.result?.metadata) return
    const meta = task.result.metadata as Ai33STTMetadata
    if (meta.json_url) {
      try {
        const res = (await window.api.ai33DownloadFile({ url: meta.json_url, fileName: 'transcription.json' })) as Ai33DownloadResult
        if (res.success) {
          setTranscription(res.localPath)
        }
      } catch {
        // silent
      }
    }
  }, [task.result])

  return (
    <div className="space-y-4">
      <FilePickerField label="Arquivo de audio" value={filePath} onPick={pickFile} filters={AUDIO_FILTERS} />

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!filePath || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-1.5 h-4 w-4" />
        )}
        Transcrever
      </Button>

      <TaskStatusDisplay task={task} />

      {task.status === 'done' && task.result?.metadata && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownloadSrt}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Baixar SRT
            </Button>
            <Button variant="secondary" size="sm" onClick={handleDownloadJson}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Baixar JSON
            </Button>
          </div>
          {transcription && (
            <div className="text-xs text-text-muted">Salvo: {transcription}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Sound Effects
// ---------------------------------------------------------------------------

function SoundEffectTool(): React.JSX.Element {
  const [text, setText] = useState('')
  const [duration, setDuration] = useState('5')
  const [promptInfluence, setPromptInfluence] = useState(0.5)
  const [loop, setLoop] = useState(false)
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const { startPolling, stopPolling } = useTaskPoller()

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })

    try {
      const res = (await window.api.ai33SoundEffect({
        text: text.trim(),
        duration_seconds: parseFloat(duration) || 5,
        prompt_influence: promptInfluence,
        loop
      })) as Ai33TaskCreatedResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({ ...prev, taskId: res.task_id, status: 'polling' }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [text, duration, promptInfluence, loop, startPolling, stopPolling])

  const handleDownload = useCallback(async () => {
    if (!task.result?.metadata) return
    const meta = task.result.metadata as Ai33SoundEffectMetadata
    if (meta.output_uri) {
      try {
        const res = (await window.api.ai33DownloadFile({ url: meta.output_uri })) as Ai33DownloadResult
        if (res.success) {
          setTask((prev) => ({ ...prev, downloadedPath: res.localPath }))
        }
      } catch {
        // silent
      }
    }
  }, [task.result])

  return (
    <div className="space-y-4">
      <TextArea
        label="Descricao do efeito"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ex: Thunder rumbling in the distance, rain falling on a metal roof"
        rows={3}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Duracao (segundos)"
          type="number"
          min={0.5}
          max={22}
          step={0.5}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">
            Influencia do prompt: {promptInfluence.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={promptInfluence}
            onChange={(e) => setPromptInfluence(parseFloat(e.target.value))}
            className="mt-1.5 w-full accent-primary"
          />
        </div>
      </div>

      <ToggleSwitch label="Loop" checked={loop} onChange={setLoop} />

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!text.trim() || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="mr-1.5 h-4 w-4" />
        )}
        Gerar efeito
      </Button>

      <TaskStatusDisplay task={task} onDownload={handleDownload} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Voice Changer
// ---------------------------------------------------------------------------

function VoiceChangerTool(): React.JSX.Element {
  const [filePath, setFilePath] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [voices, setVoices] = useState<Ai33ElevenLabsVoice[]>([])
  const [removeNoise, setRemoveNoise] = useState(false)
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const { startPolling, stopPolling } = useTaskPoller()

  useEffect(() => {
    async function loadVoices() {
      try {
        const res = (await window.api.ai33GetVoices()) as Ai33VoicesResponse
        if (res.voices) {
          setVoices(res.voices)
          if (res.voices.length > 0 && !voiceId) {
            setVoiceId(res.voices[0].voice_id)
          }
        }
      } catch {
        // silent
      }
    }
    loadVoices()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickFile = useCallback(async () => {
    const files = await window.api.selectFiles(AUDIO_FILTERS)
    if (files.length > 0) setFilePath(files[0])
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!filePath || !voiceId) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })

    try {
      const res = (await window.api.ai33VoiceChanger({
        filePath,
        voice_id: voiceId,
        remove_background_noise: removeNoise
      })) as Ai33VoiceChangerResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({
          ...prev,
          taskId: res.task_id,
          status: 'polling',
          creditCost: res.credit_cost
        }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [filePath, voiceId, removeNoise, startPolling, stopPolling])

  const handleDownload = useCallback(async () => {
    if (!task.result?.metadata) return
    const meta = task.result.metadata as Ai33VoiceChangerMetadata
    if (meta.audio_url) {
      try {
        const res = (await window.api.ai33DownloadFile({ url: meta.audio_url })) as Ai33DownloadResult
        if (res.success) {
          setTask((prev) => ({ ...prev, downloadedPath: res.localPath }))
        }
      } catch {
        // silent
      }
    }
  }, [task.result])

  const voiceOptions = voices.map((v) => ({
    value: v.voice_id,
    label: v.name + (v.labels?.accent ? ` (${v.labels.accent})` : '')
  }))

  return (
    <div className="space-y-4">
      <FilePickerField label="Arquivo de audio" value={filePath} onPick={pickFile} filters={AUDIO_FILTERS} />

      <Select
        label="Voz de destino (ElevenLabs)"
        options={voiceOptions.length > 0 ? voiceOptions : [{ value: '', label: 'Carregando vozes...' }]}
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
      />

      <ToggleSwitch label="Remover ruido de fundo" checked={removeNoise} onChange={setRemoveNoise} />

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!filePath || !voiceId || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <UserCog className="mr-1.5 h-4 w-4" />
        )}
        Alterar voz
      </Button>

      <TaskStatusDisplay task={task} onDownload={handleDownload} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Voice Isolate
// ---------------------------------------------------------------------------

function VoiceIsolateTool(): React.JSX.Element {
  const [filePath, setFilePath] = useState('')
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const { startPolling, stopPolling } = useTaskPoller()

  const pickFile = useCallback(async () => {
    const files = await window.api.selectFiles(AUDIO_FILTERS)
    if (files.length > 0) setFilePath(files[0])
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!filePath) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })

    try {
      const res = (await window.api.ai33VoiceIsolate(filePath)) as Ai33TaskCreatedResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({ ...prev, taskId: res.task_id, status: 'polling' }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [filePath, startPolling, stopPolling])

  const handleDownload = useCallback(async () => {
    if (!task.result?.metadata) return
    const meta = task.result.metadata as Ai33VoiceIsolateMetadata
    if (meta.output_uri) {
      try {
        const res = (await window.api.ai33DownloadFile({ url: meta.output_uri })) as Ai33DownloadResult
        if (res.success) {
          setTask((prev) => ({ ...prev, downloadedPath: res.localPath }))
        }
      } catch {
        // silent
      }
    }
  }, [task.result])

  return (
    <div className="space-y-4">
      <FilePickerField label="Arquivo de audio" value={filePath} onPick={pickFile} filters={AUDIO_FILTERS} />

      <p className="text-xs text-text-muted">
        Isola a voz humana do audio, removendo musica, ruido de fundo e outros sons.
      </p>

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!filePath || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Filter className="mr-1.5 h-4 w-4" />
        )}
        Isolar voz
      </Button>

      <TaskStatusDisplay task={task} onDownload={handleDownload} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Music Generation
// ---------------------------------------------------------------------------

function MusicGenerationTool(): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [idea, setIdea] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [styleId, setStyleId] = useState('')
  const [moodId, setMoodId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [numGenerations, setNumGenerations] = useState('2')
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const [downloadedUrls, setDownloadedUrls] = useState<string[]>([])
  const { startPolling, stopPolling } = useTaskPoller()

  const handleSubmit = useCallback(async () => {
    if (!idea.trim() && !lyrics.trim()) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })
    setDownloadedUrls([])

    try {
      const res = (await window.api.ai33MusicGeneration({
        title: title.trim() || undefined,
        idea: idea.trim() || undefined,
        lyrics: lyrics.trim() || undefined,
        style_id: styleId || undefined,
        mood_id: moodId || undefined,
        scenario_id: scenarioId || undefined,
        n: parseInt(numGenerations) || 2,
        rewrite_idea_switch: false
      })) as Ai33TaskCreatedResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({ ...prev, taskId: res.task_id, status: 'polling' }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [title, idea, lyrics, styleId, moodId, scenarioId, numGenerations, startPolling, stopPolling])

  const handleDownloadTrack = useCallback(async (url: string, index: number) => {
    try {
      const res = (await window.api.ai33DownloadFile({ url, fileName: `music_track_${index + 1}.mp3` })) as Ai33DownloadResult
      if (res.success) {
        setDownloadedUrls((prev) => [...prev, res.localPath])
      }
    } catch {
      // silent
    }
  }, [])

  const musicMeta = task.result?.metadata as Ai33MusicMetadata | undefined

  return (
    <div className="space-y-4">
      <Input label="Titulo (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Epic Adventure Theme" />

      <TextArea
        label="Ideia / descricao"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="Ex: An upbeat electronic track with a cinematic feel, building to a climax"
        rows={3}
      />

      <TextArea
        label="Letra (opcional)"
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Insira a letra da musica se desejar..."
        rows={4}
      />

      <div className="grid grid-cols-3 gap-3">
        <Input label="Style ID" value={styleId} onChange={(e) => setStyleId(e.target.value)} placeholder="ex: pop" />
        <Input label="Mood ID" value={moodId} onChange={(e) => setMoodId(e.target.value)} placeholder="ex: happy" />
        <Input label="Scenario ID" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} placeholder="ex: gaming" />
      </div>

      <Input
        label="Numero de geracoes"
        type="number"
        min={1}
        max={4}
        value={numGenerations}
        onChange={(e) => setNumGenerations(e.target.value)}
      />

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={(!idea.trim() && !lyrics.trim()) || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Music className="mr-1.5 h-4 w-4" />
        )}
        Gerar musica
      </Button>

      <TaskStatusDisplay task={task} />

      {task.status === 'done' && musicMeta?.audio_url && musicMeta.audio_url.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-muted">Resultados ({musicMeta.audio_url.length} faixas)</h4>
          {musicMeta.audio_url.map((url, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
              <AudioPlayer src={url} />
              <div className="flex-1" />
              <Button variant="secondary" size="sm" onClick={() => handleDownloadTrack(url, i)}>
                <Download className="mr-1 h-3 w-3" />
                Baixar
              </Button>
            </div>
          ))}
          {downloadedUrls.length > 0 && (
            <div className="text-xs text-text-muted">
              {downloadedUrls.length} faixa(s) baixada(s)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tool: Image Generation
// ---------------------------------------------------------------------------

function ImageGenerationTool(): React.JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [modelId, setModelId] = useState('')
  const [models, setModels] = useState<Ai33ImageModel[]>([])
  const [numGenerations, setNumGenerations] = useState('1')
  const [assetPaths, setAssetPaths] = useState<string[]>([])
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [task, setTask] = useState<TaskState>(initialTaskState)
  const [downloadedImages, setDownloadedImages] = useState<string[]>([])
  const { startPolling, stopPolling } = useTaskPoller()

  useEffect(() => {
    async function loadModels() {
      try {
        const res = (await window.api.ai33ImageModels()) as Ai33ImageModelsResponse
        if (res.success && res.models) {
          setModels(res.models)
          if (res.models.length > 0 && !modelId) {
            setModelId(res.models[0].model_id)
          }
        }
      } catch {
        // silent
      }
    }
    loadModels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickAssets = useCallback(async () => {
    const files = await window.api.selectFiles(IMAGE_FILTERS)
    if (files.length > 0) setAssetPaths(files)
  }, [])

  const estimatePrice = useCallback(async () => {
    if (!modelId) return
    setPriceLoading(true)
    setPriceEstimate(null)

    try {
      const res = (await window.api.ai33ImagePrice({
        model_id: modelId,
        generations_count: parseInt(numGenerations) || 1
      })) as Ai33ImagePriceResponse

      if (res.success) {
        setPriceEstimate(res.credits)
      }
    } catch {
      // silent
    } finally {
      setPriceLoading(false)
    }
  }, [modelId, numGenerations])

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || !modelId) return
    stopPolling()
    setTask({ ...initialTaskState(), status: 'submitting' })
    setDownloadedImages([])

    try {
      const res = (await window.api.ai33GenerateImage({
        prompt: prompt.trim(),
        model_id: modelId,
        generations_count: parseInt(numGenerations) || 1,
        assetPaths: assetPaths.length > 0 ? assetPaths : undefined
      })) as Ai33ImageGenerateResponse

      if (res.success && res.task_id) {
        setTask((prev) => ({ ...prev, taskId: res.task_id, status: 'polling' }))
        startPolling(
          res.task_id,
          (t) => setTask((prev) => ({ ...prev, progress: t.progress })),
          (t) => setTask((prev) => ({
            ...prev,
            status: 'done',
            result: t,
            creditCost: t.credit_cost,
            progress: 1
          })),
          (msg) => setTask((prev) => ({ ...prev, status: 'error', errorMessage: msg }))
        )
      } else {
        setTask((prev) => ({ ...prev, status: 'error', errorMessage: 'Falha ao criar task' }))
      }
    } catch (err) {
      setTask((prev) => ({ ...prev, status: 'error', errorMessage: err instanceof Error ? err.message : 'Erro' }))
    }
  }, [prompt, modelId, numGenerations, assetPaths, startPolling, stopPolling])

  const handleDownloadImage = useCallback(async (url: string, index: number) => {
    try {
      const res = (await window.api.ai33DownloadFile({ url, fileName: `generated_image_${index + 1}.png` })) as Ai33DownloadResult
      if (res.success) {
        setDownloadedImages((prev) => [...prev, res.localPath])
      }
    } catch {
      // silent
    }
  }, [])

  const modelOptions = models.map((m) => ({
    value: m.model_id,
    label: m.model_id
  }))

  const selectedModel = models.find((m) => m.model_id === modelId)
  const imageMeta = task.result?.metadata as Ai33ImageMetadata | undefined

  return (
    <div className="space-y-4">
      <TextArea
        label="Prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Descreva a imagem que deseja gerar..."
        rows={4}
      />

      <Select
        label="Modelo"
        options={modelOptions.length > 0 ? modelOptions : [{ value: '', label: 'Carregando modelos...' }]}
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
      />

      {selectedModel && (
        <div className="text-[11px] text-text-muted">
          Max geracoes: {selectedModel.max_generations}
          {selectedModel.aspect_ratios && selectedModel.aspect_ratios.length > 0 && (
            <span className="ml-3">Aspect ratios: {selectedModel.aspect_ratios.join(', ')}</span>
          )}
        </div>
      )}

      <Input
        label="Numero de geracoes"
        type="number"
        min={1}
        max={selectedModel?.max_generations ?? 4}
        value={numGenerations}
        onChange={(e) => setNumGenerations(e.target.value)}
      />

      <FilePickerField
        label="Imagens de referencia (opcional)"
        value={assetPaths}
        onPick={pickAssets}
        filters={IMAGE_FILTERS}
        multiple
      />

      {/* Price estimation */}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={estimatePrice} disabled={!modelId || priceLoading}>
          {priceLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Coins className="mr-1 h-3 w-3" />}
          Estimar preco
        </Button>
        {priceEstimate !== null && (
          <span className="text-xs text-text-muted">
            Estimativa: <span className="font-medium text-text">{priceEstimate}</span> creditos
          </span>
        )}
      </div>

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!prompt.trim() || !modelId || task.status === 'submitting' || task.status === 'polling'}
      >
        {task.status === 'submitting' || task.status === 'polling' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Image className="mr-1.5 h-4 w-4" />
        )}
        Gerar imagem
      </Button>

      <TaskStatusDisplay task={task} />

      {task.status === 'done' && imageMeta?.result_images && imageMeta.result_images.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-text-muted">Resultados ({imageMeta.result_images.length} imagens)</h4>
          <div className="grid grid-cols-2 gap-3">
            {imageMeta.result_images.map((img, i) => (
              <div key={img.id} className="overflow-hidden rounded-lg border border-border bg-bg">
                <img
                  src={img.previewUrl || img.imageUrl}
                  alt={`Gerada ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-[11px] text-text-muted">{img.width}x{img.height}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadImage(img.imageUrl, i)}>
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {downloadedImages.length > 0 && (
            <div className="text-xs text-text-muted">
              {downloadedImages.length} imagem(ns) baixada(s)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function Ai33ToolsPanel(): React.JSX.Element {
  const [activeTool, setActiveTool] = useState<ToolId>('voice-clone')
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(false)

  const loadCredits = useCallback(async () => {
    setCreditsLoading(true)
    try {
      const keyExists = await window.api.ai33HasApiKey()
      setHasApiKey(keyExists)

      if (keyExists) {
        const res = (await window.api.ai33GetCredits()) as Ai33CreditsResponse
        if (res.success) {
          setCredits(res.credits)
        }
      }
    } catch {
      // silent
    } finally {
      setCreditsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCredits()
  }, [loadCredits])

  const activeToolDef = TOOLS.find((t) => t.id === activeTool)!

  const renderTool = useCallback(() => {
    switch (activeTool) {
      case 'voice-clone':
        return <VoiceCloneTool />
      case 'dubbing':
        return <DubbingTool />
      case 'stt':
        return <SpeechToTextTool />
      case 'sound-effect':
        return <SoundEffectTool />
      case 'voice-changer':
        return <VoiceChangerTool />
      case 'voice-isolate':
        return <VoiceIsolateTool />
      case 'music':
        return <MusicGenerationTool />
      case 'image':
        return <ImageGenerationTool />
    }
  }, [activeTool])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar - tool selection */}
      <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg py-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          const isActive = tool.id === activeTool

          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text'
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {isActive && (
                <motion.div
                  layoutId="ai33-tool-indicator"
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              {(() => {
                const Icon = activeToolDef.icon
                return <Icon className="h-4 w-4 text-primary" />
              })()}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">{activeToolDef.label}</h2>
              <p className="text-[11px] text-text-muted">{activeToolDef.description}</p>
            </div>
          </div>

          {/* Credits display */}
          <div className="flex items-center gap-2">
            {hasApiKey === false && (
              <div className="flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2.5 py-1">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[11px] text-yellow-400">API key nao configurada</span>
              </div>
            )}
            {hasApiKey && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Coins className="h-3.5 w-3.5" />
                {creditsLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : credits !== null ? (
                  <span className="font-medium text-text">{credits.toLocaleString('pt-BR')}</span>
                ) : (
                  '--'
                )}
                <span>creditos</span>
                <button
                  type="button"
                  onClick={loadCredits}
                  disabled={creditsLoading}
                  className="ml-1 text-text-muted transition-colors hover:text-text"
                >
                  <RefreshCw className={`h-3 w-3 ${creditsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* API key warning overlay */}
        {hasApiKey === false && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-yellow-400" />
              <h3 className="mb-1 text-sm font-semibold text-text">API key ai33.pro necessaria</h3>
              <p className="text-xs text-text-muted">
                Configure sua API key nas configuracoes do app para utilizar as ferramentas de IA.
                Acesse Configuracoes {' > '} ai33.pro e insira sua chave.
              </p>
            </div>
          </div>
        )}

        {/* Tool content */}
        {hasApiKey !== false && (
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.15 }}
              >
                {renderTool()}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
