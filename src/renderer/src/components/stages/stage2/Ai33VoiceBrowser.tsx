import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Search, Play, Pause, Check, Loader2, ChevronDown } from 'lucide-react'
import type {
  Ai33ElevenLabsVoice,
  Ai33MiniMaxVoiceItem,
  Ai33ClonedVoice,
  Ai33VoicesResponse,
  Ai33MiniMaxVoiceListResponse,
  Ai33ClonedVoicesListResponse,
  Ai33TtsProvider
} from '@/types/ai33'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Ai33VoiceBrowserProps {
  provider: Ai33TtsProvider
  selectedVoiceId?: string
  onSelectVoice: (voiceId: string, voiceName: string) => void
}

interface NormalizedVoice {
  id: string
  name: string
  tags: string[]
  previewUrl: string | null
  isCloned: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MINIMAX_PAGE_SIZE = 50

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeElevenLabsVoice(v: Ai33ElevenLabsVoice): NormalizedVoice {
  const tags: string[] = []
  if (v.category) tags.push(v.category)
  if (v.labels) {
    for (const val of Object.values(v.labels)) {
      if (val && !tags.includes(val)) tags.push(val)
    }
  }
  return {
    id: v.voice_id,
    name: v.name,
    tags,
    previewUrl: v.preview_url ?? null,
    isCloned: false
  }
}

function normalizeMiniMaxVoice(v: Ai33MiniMaxVoiceItem): NormalizedVoice {
  const tags: string[] = []
  if (v.tags) tags.push(...v.tags)
  if (v.language) tags.push(v.language)
  if (v.gender) tags.push(v.gender)
  return {
    id: v.voice_id ?? '',
    name: v.name ?? 'Sem nome',
    tags,
    previewUrl: v.preview_url ?? v.sample_url ?? null,
    isCloned: false
  }
}

function normalizeClonedVoice(v: Ai33ClonedVoice): NormalizedVoice {
  return {
    id: v.voice_id,
    name: v.voice_name,
    tags: v.tag_list ?? ['clonado'],
    previewUrl: v.sample_audio ?? null,
    isCloned: true
  }
}

// ---------------------------------------------------------------------------
// VoiceCard
// ---------------------------------------------------------------------------

interface VoiceCardProps {
  voice: NormalizedVoice
  isSelected: boolean
  isPlaying: boolean
  onSelect: () => void
  onTogglePreview: () => void
}

function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  onSelect,
  onTogglePreview
}: VoiceCardProps): React.JSX.Element {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 ${
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover'
      }`}
    >
      {/* Preview button */}
      {voice.previewUrl ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePreview()
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-text-muted transition-colors hover:border-primary hover:text-primary"
          title={isPlaying ? 'Pausar preview' : 'Ouvir preview'}
        >
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-bg">
          <Play className="h-3 w-3 text-text-muted/30" />
        </div>
      )}

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-xs font-medium text-text">{voice.name}</span>
        {voice.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {voice.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className={`rounded px-1.5 py-0.5 text-[10px] leading-none ${
                  voice.isCloned
                    ? 'bg-violet-500/15 text-violet-300'
                    : 'bg-primary/10 text-primary-light'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Select button */}
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-[11px] font-medium transition-all duration-150 ${
          isSelected
            ? 'bg-primary text-white'
            : 'border border-border text-text-muted hover:border-primary hover:text-primary'
        }`}
      >
        {isSelected ? (
          <>
            <Check className="h-3 w-3" />
            Selecionado
          </>
        ) : (
          'Selecionar'
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Ai33VoiceBrowser({
  provider,
  selectedVoiceId,
  onSelectVoice
}: Ai33VoiceBrowserProps): React.JSX.Element {
  // State: voices cache
  const [elevenLabsVoices, setElevenLabsVoices] = useState<NormalizedVoice[] | null>(null)
  const [miniMaxVoices, setMiniMaxVoices] = useState<NormalizedVoice[]>([])
  const [miniMaxCloned, setMiniMaxCloned] = useState<NormalizedVoice[]>([])
  const [miniMaxHasMore, setMiniMaxHasMore] = useState(false)
  const [miniMaxPage, setMiniMaxPage] = useState(1)
  const [miniMaxTotal, setMiniMaxTotal] = useState(0)

  // State: UI
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Audio ref
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Track if initial load happened per provider
  const loadedProviders = useRef<Set<string>>(new Set())

  // ---------------------------------------------------------------------------
  // Load ElevenLabs voices
  // ---------------------------------------------------------------------------
  const loadElevenLabs = useCallback(async () => {
    if (elevenLabsVoices !== null) return // already cached
    setLoading(true)
    setError(null)
    try {
      const res = (await window.api.ai33GetVoices()) as Ai33VoicesResponse
      const voices = (res.voices ?? []).map(normalizeElevenLabsVoice)
      setElevenLabsVoices(voices)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vozes ElevenLabs')
    } finally {
      setLoading(false)
    }
  }, [elevenLabsVoices])

  // ---------------------------------------------------------------------------
  // Load MiniMax voices (paginated)
  // ---------------------------------------------------------------------------
  const loadMiniMaxPage = useCallback(
    async (page: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        const res = (await window.api.ai33MinimaxVoiceList({
          page,
          page_size: MINIMAX_PAGE_SIZE
        })) as Ai33MiniMaxVoiceListResponse

        if (res.success) {
          const normalized = res.data.voice_list.map(normalizeMiniMaxVoice)
          if (append) {
            setMiniMaxVoices((prev) => [...prev, ...normalized])
          } else {
            setMiniMaxVoices(normalized)
          }
          setMiniMaxHasMore(res.data.has_more)
          setMiniMaxTotal(res.data.total)
          setMiniMaxPage(page)
        } else {
          setError('Falha ao carregar vozes MiniMax')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar vozes MiniMax')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  const loadMiniMaxCloned = useCallback(async () => {
    try {
      const res = (await window.api.ai33MinimaxClonedVoices()) as Ai33ClonedVoicesListResponse
      if (res.success) {
        setMiniMaxCloned(res.data.map(normalizeClonedVoice))
      }
    } catch {
      // Cloned voices are optional, don't block
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Auto-load on mount or provider change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (loadedProviders.current.has(provider)) return
    loadedProviders.current.add(provider)

    if (provider === 'elevenlabs') {
      loadElevenLabs()
    } else {
      loadMiniMaxPage(1, false)
      loadMiniMaxCloned()
    }
  }, [provider, loadElevenLabs, loadMiniMaxPage, loadMiniMaxCloned])

  // ---------------------------------------------------------------------------
  // Audio preview
  // ---------------------------------------------------------------------------
  const handleTogglePreview = useCallback(
    (voiceId: string, previewUrl: string | null) => {
      if (!previewUrl) return

      // Stop current
      if (playingId === voiceId) {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        setPlayingId(null)
        return
      }

      // Play new
      if (audioRef.current) {
        audioRef.current.pause()
      }

      const audio = new Audio(previewUrl)
      audioRef.current = audio
      setPlayingId(voiceId)

      audio.play().catch(() => {
        setPlayingId(null)
      })

      audio.addEventListener('ended', () => {
        setPlayingId(null)
      })
      audio.addEventListener('error', () => {
        setPlayingId(null)
      })
    },
    [playingId]
  )

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Filter voices
  // ---------------------------------------------------------------------------
  const allVoices = useMemo((): NormalizedVoice[] => {
    if (provider === 'elevenlabs') {
      return elevenLabsVoices ?? []
    }
    // MiniMax: cloned first, then library voices
    return [...miniMaxCloned, ...miniMaxVoices]
  }, [provider, elevenLabsVoices, miniMaxVoices, miniMaxCloned])

  const filteredVoices = useMemo((): NormalizedVoice[] => {
    if (!search.trim()) return allVoices
    const query = search.toLowerCase()
    return allVoices.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.tags.some((t) => t.toLowerCase().includes(query))
    )
  }, [allVoices, search])

  // ---------------------------------------------------------------------------
  // Load more (MiniMax only)
  // ---------------------------------------------------------------------------
  const handleLoadMore = (): void => {
    if (provider === 'minimax' && miniMaxHasMore && !loadingMore) {
      loadMiniMaxPage(miniMaxPage + 1, true)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3">
      {/* Header row: search + count */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar vozes ${provider === 'elevenlabs' ? 'ElevenLabs' : 'MiniMax'}...`}
            className="w-full rounded-lg border border-border bg-bg py-1.5 pl-8 pr-3 text-xs text-text outline-none transition-colors placeholder:text-text-muted/50 focus:border-primary"
          />
        </div>
        <span className="shrink-0 text-[11px] text-text-muted">
          {filteredVoices.length}
          {provider === 'minimax' && miniMaxTotal > 0 && !search.trim()
            ? ` / ${miniMaxTotal}`
            : ''}{' '}
          vozes
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-text-muted">Carregando vozes...</span>
        </div>
      )}

      {/* Voice list */}
      {!loading && (
        <div className="flex max-h-[400px] flex-col gap-1.5 overflow-y-auto pr-1">
          {filteredVoices.length === 0 && !error && (
            <div className="py-6 text-center text-xs text-text-muted">
              {search.trim()
                ? 'Nenhuma voz encontrada para esta busca.'
                : 'Nenhuma voz disponivel.'}
            </div>
          )}

          {filteredVoices.map((voice) => (
            <VoiceCard
              key={`${voice.id}-${voice.isCloned ? 'cloned' : 'lib'}`}
              voice={voice}
              isSelected={selectedVoiceId === voice.id}
              isPlaying={playingId === voice.id}
              onSelect={() => onSelectVoice(voice.id, voice.name)}
              onTogglePreview={() => handleTogglePreview(voice.id, voice.previewUrl)}
            />
          ))}

          {/* Load more - MiniMax only */}
          {provider === 'minimax' && miniMaxHasMore && !search.trim() && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-text-muted transition-colors hover:border-primary/40 hover:text-text disabled:opacity-40"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Carregar mais vozes
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
