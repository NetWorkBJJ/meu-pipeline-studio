import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, FolderOpen, Check, Trash2, Loader2, ExternalLink } from 'lucide-react'
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

  // Google TTS API key state
  const [ttsHasKey, setTtsHasKey] = useState(false)
  const [ttsKeyInput, setTtsKeyInput] = useState('')
  const [ttsSaving, setTtsSaving] = useState(false)

  useEffect(() => {
    if (settingsOpen) {
      if (activeWorkspace) {
        setWsName(activeWorkspace.name)
        setWsDescription(activeWorkspace.description)
      }
      window.api.ttsHasApiKey().then(setTtsHasKey).catch(() => setTtsHasKey(false))
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

  const handleSaveTtsKey = async (): Promise<void> => {
    if (!ttsKeyInput.trim()) return
    setTtsSaving(true)
    try {
      await window.api.ttsSaveApiKey(ttsKeyInput.trim())
      setTtsHasKey(true)
      setTtsKeyInput('')
      addToast({ type: 'success', message: 'API Key Google Gemini (TTS) salva.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao salvar API Key.' })
    } finally {
      setTtsSaving(false)
    }
  }

  const handleDeleteTtsKey = async (): Promise<void> => {
    await window.api.ttsDeleteApiKey()
    setTtsHasKey(false)
    addToast({ type: 'success', message: 'API Key Google Gemini (TTS) removida.' })
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
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-surface-2 p-0 shadow-popover"
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

              {/* Google API Key (TTS) */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Google Gemini (TTS)
                </label>
                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${ttsHasKey ? 'bg-success' : 'bg-error'}`}
                      />
                      <span className="text-xs font-medium text-text">API Key</span>
                    </div>
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-primary/70 transition-colors hover:text-primary"
                    >
                      Google AI Studio
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      value={ttsKeyInput}
                      onChange={(e) => setTtsKeyInput(e.target.value)}
                      placeholder={ttsHasKey ? 'Alterar chave...' : 'Cole sua API Key'}
                      className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      disabled={!ttsKeyInput.trim() || ttsSaving}
                      onClick={handleSaveTtsKey}
                      className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                    >
                      {ttsSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Salvar
                    </button>
                    {ttsHasKey && (
                      <button
                        type="button"
                        onClick={handleDeleteTtsKey}
                        className="flex h-7 items-center rounded-md border border-border bg-surface px-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-error"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-text-muted">Modelo TTS</span>
                    <select
                      value={ttsDefaults.ttsModel}
                      onChange={(e) =>
                        setTtsDefaults({
                          ...ttsDefaults,
                          ttsModel: e.target.value as 'flash' | 'pro'
                        })
                      }
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none transition-colors focus:border-primary"
                    >
                      <option value="flash">Gemini 2.5 Flash (rapido)</option>
                      <option value="pro">Gemini 2.5 Pro (qualidade)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="flex flex-col gap-1 border-t border-border pt-4">
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Sobre
                </span>
                <span className="text-xs text-text-muted/70">MEU PIPELINE STUDIO v0.1.0</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
