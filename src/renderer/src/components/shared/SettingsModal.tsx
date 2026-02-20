import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, FolderOpen, Check, Trash2, Play, Loader2 } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

export function SettingsModal(): React.JSX.Element | null {
  const { settingsOpen, setSettingsOpen, addToast } = useUIStore()
  const {
    capCutDraftPath,
    mediaPreset,
    ttsDefaults,
    setCapCutDraftPath,
    setMediaPreset,
    setTtsDefaults,
    addRecentProject
  } = useProjectStore()
  const { activeWorkspace, activeWorkspaceId, updateWorkspace } = useWorkspaceStore()

  const [wsName, setWsName] = useState('')
  const [wsDescription, setWsDescription] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (settingsOpen) {
      window.api.ttsHasApiKey().then(setHasApiKey).catch(() => setHasApiKey(false))
      if (activeWorkspace) {
        setWsName(activeWorkspace.name)
        setWsDescription(activeWorkspace.description)
      }
    }
  }, [settingsOpen, activeWorkspace])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpen, setSettingsOpen])

  const handleChangeDraft = async (): Promise<void> => {
    const path = await window.api.selectCapCutDraft()
    if (path) {
      setCapCutDraftPath(path)
      const parts = path.replace(/\\/g, '/').split('/')
      const name = parts[parts.length - 1] || parts[parts.length - 2] || 'Projeto'
      addRecentProject({ name, path, lastOpened: Date.now() })
    }
  }

  const handleSaveWorkspaceConfig = async (): Promise<void> => {
    if (!activeWorkspaceId) return
    await updateWorkspace({
      id: activeWorkspaceId,
      name: wsName.trim() || activeWorkspace?.name || 'Workspace',
      description: wsDescription.trim()
    })
  }

  const handleChangeCapCutPath = async (): Promise<void> => {
    if (!activeWorkspaceId) return
    const selected = await window.api.selectDirectory()
    if (selected) {
      await updateWorkspace({
        id: activeWorkspaceId,
        capCutProjectsPath: selected
      })
    }
  }

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg rounded-xl border border-border bg-surface-2 p-0 shadow-popover"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-text">Configuracoes</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-6 p-5">
              {/* Workspace config */}
              {activeWorkspace && (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Workspace Ativo
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      onBlur={handleSaveWorkspaceConfig}
                      placeholder="Nome do workspace"
                      className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <textarea
                      value={wsDescription}
                      onChange={(e) => setWsDescription(e.target.value)}
                      onBlur={handleSaveWorkspaceConfig}
                      placeholder="Descricao (opcional)"
                      rows={2}
                      className="resize-none rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex-1 truncate rounded-lg border border-border bg-bg px-3 py-1.5 font-mono text-xs text-text-muted">
                        {activeWorkspace.capCutProjectsPath || 'Nenhum caminho'}
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeCapCutPath}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        CapCut Path
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CapCut Project */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Projeto CapCut
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 truncate rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs text-text-muted">
                    {capCutDraftPath || 'Nenhum projeto selecionado'}
                  </div>
                  <button
                    type="button"
                    onClick={handleChangeDraft}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Mudar
                  </button>
                </div>
              </div>

              {/* Media Preset */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Preset de Midia
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Tipo padrao</span>
                    <select
                      value={mediaPreset.defaultType}
                      onChange={(e) =>
                        setMediaPreset({
                          ...mediaPreset,
                          defaultType: e.target.value as 'video' | 'photo'
                        })
                      }
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
                    >
                      <option value="video">Video</option>
                      <option value="photo">Foto</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Duracao (ms)</span>
                    <input
                      type="number"
                      value={mediaPreset.defaultDurationMs}
                      onChange={(e) =>
                        setMediaPreset({
                          ...mediaPreset,
                          defaultDurationMs: Math.max(500, Number(e.target.value))
                        })
                      }
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
                      min={500}
                      step={100}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Transicao (ms)</span>
                    <input
                      type="number"
                      value={mediaPreset.transitionMs}
                      onChange={(e) =>
                        setMediaPreset({
                          ...mediaPreset,
                          transitionMs: Math.max(0, Number(e.target.value))
                        })
                      }
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
                      min={0}
                      step={50}
                    />
                  </div>
                </div>
              </div>

              {/* Google Gemini TTS */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Google Gemini TTS
                </label>
                {/* API Key status + input */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    <span className="text-xs text-text-muted">
                      API Key: {hasApiKey ? 'Configurada' : 'Nao configurada'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={hasApiKey ? 'Alterar chave...' : 'Cole sua API Key aqui'}
                      className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      disabled={!apiKeyInput.trim() || apiKeySaving}
                      onClick={async () => {
                        setApiKeySaving(true)
                        try {
                          await window.api.ttsSaveApiKey(apiKeyInput.trim())
                          setHasApiKey(true)
                          setApiKeyInput('')
                          addToast({ type: 'success', message: 'API Key salva.' })
                        } catch {
                          addToast({ type: 'error', message: 'Erro ao salvar API Key.' })
                        } finally {
                          setApiKeySaving(false)
                        }
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                    >
                      {apiKeySaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Salvar
                    </button>
                    {hasApiKey && (
                      <button
                        type="button"
                        onClick={async () => {
                          await window.api.ttsDeleteApiKey()
                          setHasApiKey(false)
                          addToast({ type: 'success', message: 'API Key removida.' })
                        }}
                        className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                {/* TTS Defaults */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Voz padrao</span>
                    <select
                      value={ttsDefaults.voice}
                      onChange={(e) =>
                        setTtsDefaults({ ...ttsDefaults, voice: e.target.value })
                      }
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
                    >
                      <optgroup label="Higher pitch">
                        <option value="Zephyr">Zephyr</option>
                        <option value="Leda">Leda</option>
                        <option value="Laomedeia">Laomedeia</option>
                        <option value="Achernar">Achernar</option>
                      </optgroup>
                      <optgroup label="Middle pitch">
                        <option value="Puck">Puck</option>
                        <option value="Kore">Kore</option>
                        <option value="Aoede">Aoede</option>
                        <option value="Callirrhoe">Callirrhoe</option>
                        <option value="Autonoe">Autonoe</option>
                        <option value="Despina">Despina</option>
                        <option value="Erinome">Erinome</option>
                        <option value="Rasalgethi">Rasalgethi</option>
                        <option value="Gacrux">Gacrux</option>
                        <option value="Pulcherrima">Pulcherrima</option>
                        <option value="Vindemiatrix">Vindemiatrix</option>
                        <option value="Sadaltager">Sadaltager</option>
                        <option value="Sulafat">Sulafat</option>
                      </optgroup>
                      <optgroup label="Lower middle pitch">
                        <option value="Fenrir">Fenrir</option>
                        <option value="Orus">Orus</option>
                        <option value="Iapetus">Iapetus</option>
                        <option value="Umbriel">Umbriel</option>
                        <option value="Alnilam">Alnilam</option>
                        <option value="Schedar">Schedar</option>
                        <option value="Achird">Achird</option>
                        <option value="Zubenelgenubi">Zubenelgenubi</option>
                      </optgroup>
                      <optgroup label="Lower pitch">
                        <option value="Charon">Charon</option>
                        <option value="Enceladus">Enceladus</option>
                        <option value="Algieba">Algieba</option>
                        <option value="Algenib">Algenib</option>
                        <option value="Sadachbia">Sadachbia</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Estilo padrao</span>
                    <select
                      value={ttsDefaults.style}
                      onChange={(e) =>
                        setTtsDefaults({ ...ttsDefaults, style: e.target.value })
                      }
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
                    >
                      <optgroup label="Energia">
                        <option value="Neutro">Neutro</option>
                        <option value="Energetico">Energetico</option>
                        <option value="Empolgado">Empolgado</option>
                        <option value="Calmo">Calmo</option>
                        <option value="Sussurrado">Sussurrado</option>
                        <option value="Intenso">Intenso</option>
                        <option value="Explosivo">Explosivo</option>
                      </optgroup>
                      <optgroup label="Profissao">
                        <option value="Profissional">Profissional</option>
                        <option value="Jornalistico">Jornalistico</option>
                        <option value="Locutor Radio">Locutor Radio</option>
                        <option value="Documentario">Documentario</option>
                        <option value="Educativo">Educativo</option>
                        <option value="Coach">Coach</option>
                        <option value="Influencer">Influencer</option>
                        <option value="Vendedor">Vendedor</option>
                        <option value="Podcast">Podcast</option>
                        <option value="Apresentador TV">Apresentador TV</option>
                      </optgroup>
                      <optgroup label="Emocao">
                        <option value="Dramatico">Dramatico</option>
                        <option value="Misterioso">Misterioso</option>
                        <option value="Romantico">Romantico</option>
                        <option value="Nostalgico">Nostalgico</option>
                        <option value="Esperancoso">Esperancoso</option>
                        <option value="Melancolico">Melancolico</option>
                        <option value="Raiva">Raiva</option>
                        <option value="Surpreso">Surpreso</option>
                        <option value="Inspirador">Inspirador</option>
                        <option value="Filosofico">Filosofico</option>
                      </optgroup>
                      <optgroup label="Genero">
                        <option value="Storytelling">Storytelling</option>
                        <option value="ASMR">ASMR</option>
                        <option value="Comedia">Comedia</option>
                        <option value="Terror">Terror</option>
                        <option value="Epico">Epico</option>
                        <option value="Cientifico">Cientifico</option>
                        <option value="Infantil">Infantil</option>
                        <option value="Fantasia">Fantasia</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-text-muted">Modelo TTS</span>
                    <select
                      value={ttsDefaults.ttsModel}
                      onChange={(e) =>
                        setTtsDefaults({
                          ...ttsDefaults,
                          ttsModel: e.target.value as 'flash' | 'pro'
                        })
                      }
                      className="rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors focus:border-primary"
                    >
                      <option value="flash">Flash (rapido)</option>
                      <option value="pro">Pro (qualidade)</option>
                    </select>
                  </div>
                </div>
                {/* Test voice button */}
                {hasApiKey && (
                  <button
                    type="button"
                    disabled={previewPlaying}
                    onClick={async () => {
                      setPreviewPlaying(true)
                      try {
                        const result = (await window.api.ttsPreviewVoice({
                          voice: ttsDefaults.voice,
                          style: ttsDefaults.style,
                          ttsModel: ttsDefaults.ttsModel
                        })) as { success: boolean; audio_base64?: string; error?: string }
                        if (result.success && result.audio_base64) {
                          if (previewAudioRef.current) {
                            previewAudioRef.current.pause()
                          }
                          const audio = new Audio(
                            `data:audio/wav;base64,${result.audio_base64}`
                          )
                          previewAudioRef.current = audio
                          audio.onended = () => setPreviewPlaying(false)
                          audio.onerror = () => setPreviewPlaying(false)
                          await audio.play()
                        } else {
                          addToast({
                            type: 'error',
                            message: result.error || 'Erro ao gerar preview.'
                          })
                          setPreviewPlaying(false)
                        }
                      } catch {
                        addToast({ type: 'error', message: 'Erro ao testar voz.' })
                        setPreviewPlaying(false)
                      }
                    }}
                    className="flex h-8 w-fit items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
                  >
                    {previewPlaying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Testar voz
                  </button>
                )}
              </div>

              {/* About */}
              <div className="flex flex-col gap-1 border-t border-border pt-4">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Sobre
                </span>
                <span className="text-xs text-text-muted/70">
                  MEU PIPELINE STUDIO v0.1.0
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
