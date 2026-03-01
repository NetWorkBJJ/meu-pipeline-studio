import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, FolderOpen, Check, Trash2, Loader2, ExternalLink, Pin, HardDriveDownload } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { useProjectStore } from '@/stores/useProjectStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

type SettingsTab = 'projeto' | 'apis' | 'sobre'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'projeto', label: 'Projeto' },
  { id: 'apis', label: 'APIs' },
  { id: 'sobre', label: 'Sobre' }
]

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

  const [activeTab, setActiveTab] = useState<SettingsTab>('projeto')
  const [wsName, setWsName] = useState('')
  const [wsDescription, setWsDescription] = useState('')

  // Google TTS API key state
  const [ttsHasKey, setTtsHasKey] = useState(false)
  const [ttsKeyInput, setTtsKeyInput] = useState('')
  const [ttsSaving, setTtsSaving] = useState(false)

  // ai33.pro API key state
  const [ai33HasKey, setAi33HasKey] = useState(false)
  const [ai33KeyInput, setAi33KeyInput] = useState('')
  const [ai33Saving, setAi33Saving] = useState(false)
  const [ai33Credits, setAi33Credits] = useState<number | null>(null)
  const [ai33Testing, setAi33Testing] = useState(false)

  // ClickUp API key state
  const [clickupHasKey, setClickupHasKey] = useState(false)
  const [clickupKeyInput, setClickupKeyInput] = useState('')
  const [clickupSaving, setClickupSaving] = useState(false)
  const [clickupTesting, setClickupTesting] = useState(false)
  const [clickupTeamName, setClickupTeamName] = useState<string | null>(null)
  const [clickupDefaultList, setClickupDefaultList] = useState<{
    listId: string
    listName: string
    breadcrumb: string
  } | null>(null)

  useEffect(() => {
    if (settingsOpen) {
      if (activeWorkspace) {
        setWsName(activeWorkspace.name)
        setWsDescription(activeWorkspace.description)
      }
      window.api.ttsHasApiKey().then(setTtsHasKey).catch(() => setTtsHasKey(false))
      window.api.ai33HasApiKey().then(setAi33HasKey).catch(() => setAi33HasKey(false))
      window.api.clickupHasApiKey().then(setClickupHasKey).catch(() => setClickupHasKey(false))
      window.api
        .clickupGetDefaultList()
        .then((res) => {
          const config = res as { listId: string; listName: string; breadcrumb: string } | null
          setClickupDefaultList(config && config.listId ? config : null)
        })
        .catch(() => setClickupDefaultList(null))
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

  const handleSaveAi33Key = async (): Promise<void> => {
    if (!ai33KeyInput.trim()) return
    setAi33Saving(true)
    try {
      await window.api.ai33SaveApiKey(ai33KeyInput.trim())
      setAi33HasKey(true)
      setAi33KeyInput('')
      addToast({ type: 'success', message: 'API Key ai33.pro salva.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao salvar API Key ai33.pro.' })
    } finally {
      setAi33Saving(false)
    }
  }

  const handleDeleteAi33Key = async (): Promise<void> => {
    await window.api.ai33DeleteApiKey()
    setAi33HasKey(false)
    setAi33Credits(null)
    addToast({ type: 'success', message: 'API Key ai33.pro removida.' })
  }

  const handleTestAi33 = async (): Promise<void> => {
    setAi33Testing(true)
    try {
      const res = (await window.api.ai33GetCredits()) as { success: boolean; credits: number }
      if (res.success) {
        setAi33Credits(res.credits)
        addToast({ type: 'success', message: `ai33.pro conectado. Creditos: ${res.credits}` })
      } else {
        addToast({ type: 'error', message: 'ai33.pro: falha ao verificar creditos.' })
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao testar ai33.pro.'
      })
    } finally {
      setAi33Testing(false)
    }
  }

  const handleSaveClickupKey = async (): Promise<void> => {
    if (!clickupKeyInput.trim()) return
    setClickupSaving(true)
    try {
      await window.api.clickupSaveApiKey(clickupKeyInput.trim())
      setClickupHasKey(true)
      setClickupKeyInput('')
      addToast({ type: 'success', message: 'API Token ClickUp salvo.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao salvar API Token ClickUp.' })
    } finally {
      setClickupSaving(false)
    }
  }

  const handleDeleteClickupKey = async (): Promise<void> => {
    await window.api.clickupDeleteApiKey()
    setClickupHasKey(false)
    setClickupTeamName(null)
    addToast({ type: 'success', message: 'API Token ClickUp removido.' })
  }

  const handleClearClickupDefaultList = async (): Promise<void> => {
    try {
      await window.api.clickupSaveDefaultList(null)
      setClickupDefaultList(null)
      addToast({ type: 'success', message: 'Lista padrao removida.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao remover lista padrao.' })
    }
  }

  const handleTestClickup = async (): Promise<void> => {
    setClickupTesting(true)
    try {
      const res = (await window.api.clickupTestConnection()) as {
        success: boolean
        teamName: string | null
      }
      if (res.success && res.teamName) {
        setClickupTeamName(res.teamName)
        addToast({ type: 'success', message: `ClickUp conectado: ${res.teamName}` })
      } else {
        addToast({ type: 'warning', message: 'ClickUp conectado, mas nenhum workspace encontrado.' })
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao testar ClickUp.'
      })
    } finally {
      setClickupTesting(false)
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
            className="flex w-full max-w-2xl max-h-[85vh] flex-col rounded-xl border border-border bg-surface-2 p-0 shadow-popover"
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

            {/* Tab bar */}
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                      activeTab === tab.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-muted hover:bg-bg hover:text-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6 p-5">
                {activeTab === 'projeto' && (
                  <>
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
                  </>
                )}

                {activeTab === 'apis' && (
                  <>
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

                    {/* ai33.pro API Key */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                        ai33.pro (ElevenLabs + MiniMax)
                      </label>
                      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${ai33HasKey ? 'bg-success' : 'bg-error'}`}
                            />
                            <span className="text-xs font-medium text-text">API Key</span>
                          </div>
                          <a
                            href="https://ai33.pro"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-primary/70 transition-colors hover:text-primary"
                          >
                            ai33.pro
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            value={ai33KeyInput}
                            onChange={(e) => setAi33KeyInput(e.target.value)}
                            placeholder={ai33HasKey ? 'Alterar chave...' : 'Cole sua API Key ai33.pro'}
                            className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            disabled={!ai33KeyInput.trim() || ai33Saving}
                            onClick={handleSaveAi33Key}
                            className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                          >
                            {ai33Saving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Salvar
                          </button>
                          {ai33HasKey && (
                            <button
                              type="button"
                              onClick={handleDeleteAi33Key}
                              className="flex h-7 items-center rounded-md border border-border bg-surface px-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-error"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {ai33HasKey && (
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={ai33Testing}
                              onClick={handleTestAi33}
                              className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[10px] font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-40"
                            >
                              {ai33Testing ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : null}
                              Testar conexao
                            </button>
                            {ai33Credits !== null && (
                              <span className="text-[10px] text-text-muted">
                                Creditos: {ai33Credits.toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ClickUp API Token */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                        ClickUp (Demandas)
                      </label>
                      <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${clickupHasKey ? 'bg-success' : 'bg-error'}`}
                            />
                            <span className="text-xs font-medium text-text">Personal API Token</span>
                          </div>
                          <a
                            href="https://app.clickup.com/settings/apps"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-primary/70 transition-colors hover:text-primary"
                          >
                            ClickUp Apps
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            value={clickupKeyInput}
                            onChange={(e) => setClickupKeyInput(e.target.value)}
                            placeholder={clickupHasKey ? 'Alterar token...' : 'Cole seu Personal API Token (pk_...)'}
                            className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none focus:border-primary"
                          />
                          <button
                            type="button"
                            disabled={!clickupKeyInput.trim() || clickupSaving}
                            onClick={handleSaveClickupKey}
                            className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                          >
                            {clickupSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Salvar
                          </button>
                          {clickupHasKey && (
                            <button
                              type="button"
                              onClick={handleDeleteClickupKey}
                              className="flex h-7 items-center rounded-md border border-border bg-surface px-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-error"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {clickupHasKey && (
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={clickupTesting}
                              onClick={handleTestClickup}
                              className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[10px] font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-40"
                            >
                              {clickupTesting ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : null}
                              Testar conexao
                            </button>
                            {clickupTeamName && (
                              <span className="text-[10px] text-text-muted">
                                Workspace: {clickupTeamName}
                              </span>
                            )}
                          </div>
                        )}
                        {clickupHasKey && (
                          <div className="mt-2 border-t border-border/50 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-text-muted">Lista Padrao</span>
                            </div>
                            {clickupDefaultList ? (
                              <div className="mt-1 flex items-center gap-2">
                                <Pin className="h-3 w-3 shrink-0 text-primary" />
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs text-text">{clickupDefaultList.listName}</span>
                                  <span className="ml-1.5 text-[10px] text-text-muted">
                                    {clickupDefaultList.breadcrumb}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleClearClickupDefaultList}
                                  className="flex h-5 items-center rounded border border-border bg-surface px-1.5 text-[10px] text-text-muted transition-colors hover:text-error"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ) : (
                              <p className="mt-1 text-[10px] text-text-muted/60">
                                Nenhuma. Fixe uma lista no modal de importacao.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'sobre' && (
                  <SobreTab addToast={addToast} />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SobreTab({ addToast }: { addToast: (t: { type: string; message: string }) => void }): React.JSX.Element {
  const [appVersion, setAppVersion] = useState('')
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    window.api.updaterGetVersion().then(setAppVersion).catch(() => {})
  }, [])

  const handleClearCache = async (): Promise<void> => {
    setClearing(true)
    try {
      await window.api.systemClearCache()
      addToast({ type: 'success', message: 'Cache limpo. Reinicie o app para aplicar.' })
    } catch {
      addToast({ type: 'error', message: 'Erro ao limpar cache.' })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Sobre
        </label>
        <span className="text-sm text-text">
          WorkFlowAA {appVersion ? `v${appVersion}` : ''}
        </span>
        <span className="text-xs text-text-muted/70">
          Studio de pre-edicao automatizada para CapCut
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Manutencao
        </label>
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-text">Limpar cache</span>
              <span className="text-[10px] text-text-muted">
                Remove cache do navegador Veo3 e dados temporarios. Util para resolver problemas apos atualizacoes.
              </span>
            </div>
            <button
              type="button"
              disabled={clearing}
              onClick={handleClearCache}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              {clearing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HardDriveDownload className="h-3.5 w-3.5" />
              )}
              Limpar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
