import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Film,
  ImageIcon,
  ArrowLeftRight,
  Brain,
  RefreshCw,
  CheckCircle2,
  FolderOpen,
  Users,
  Trash2,
  ExternalLink,
  Terminal
} from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { parseCharacterFilenames } from '@/lib/characterParser'
import type { SequenceMode } from '@/types/project'

interface DirectorConfigPanelProps {
  onConfirm: () => void
}

const SEQUENCE_MODES: Array<{
  value: SequenceMode
  label: string
  description: string
  icon: React.ElementType
}> = [
  {
    value: 'video-only',
    label: 'So videos',
    description: 'Todas as cenas serao videos (6-8s cada)',
    icon: Film
  },
  {
    value: 'image-only',
    label: 'So imagens',
    description: 'Todas as cenas serao imagens (3-5s cada)',
    icon: ImageIcon
  },
  {
    value: 'alternating',
    label: 'Intercalado',
    description: 'Alterna entre videos e imagens',
    icon: ArrowLeftRight
  },
  {
    value: 'ai-decided',
    label: 'IA decide',
    description: 'O LLM escolhe baseado no enredo',
    icon: Brain
  }
]

const LLM_PROVIDERS = [
  {
    value: 'claude',
    label: 'Claude Code',
    npmPkg: '@anthropic-ai/claude-code',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    loginCmd: 'claude login'
  },
  {
    value: 'codex',
    label: 'OpenAI Codex',
    npmPkg: '@openai/codex',
    installUrl: 'https://github.com/openai/codex',
    loginCmd: 'codex'
  },
  {
    value: 'gemini',
    label: 'Gemini CLI',
    npmPkg: '@google/gemini-cli',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
    loginCmd: 'gemini'
  }
] as const

export function DirectorConfigPanel({ onConfirm }: DirectorConfigPanelProps): React.JSX.Element {
  const config = useProjectStore((s) => s.directorConfig)
  const characterRefs = useProjectStore((s) => s.characterRefs)
  const setDirectorConfig = useProjectStore((s) => s.setDirectorConfig)
  const setCharacterRefs = useProjectStore((s) => s.setCharacterRefs)
  const { addToast } = useUIStore()

  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(null)
  const [checkingLlm, setCheckingLlm] = useState(false)
  const [installing, setInstalling] = useState(false)

  const checkLlm = async (): Promise<void> => {
    setCheckingLlm(true)
    try {
      const result = (await window.api.directorCheckLlm(config.llmProvider)) as {
        available: boolean
      }
      setLlmAvailable(result.available)
      if (!result.available) {
        addToast({
          type: 'warning',
          message: `CLI '${config.llmProvider}' nao encontrado no PATH.`
        })
      }
    } catch {
      setLlmAvailable(false)
    } finally {
      setCheckingLlm(false)
    }
  }

  useEffect(() => {
    checkLlm()
  }, [config.llmProvider])

  const handleImportCharacters = async (): Promise<void> => {
    try {
      const result = (await window.api.directorImportCharacters()) as {
        files: string[]
        directory?: string
      }
      if (result.files.length === 0) return

      const parsed = parseCharacterFilenames(result.files)
      if (parsed.length === 0) {
        addToast({
          type: 'warning',
          message:
            'Nenhum personagem detectado. Use o formato: "Nome - Role, chapter(s) N"'
        })
        return
      }

      setCharacterRefs(parsed)
      addToast({
        type: 'success',
        message: `${parsed.length} referencia(s) de personagem importada(s).`
      })
    } catch {
      addToast({ type: 'error', message: 'Erro ao importar personagens.' })
    }
  }

  const uniqueNames = [...new Set(characterRefs.map((c) => c.name))]

  return (
    <div className="flex flex-col gap-5">
      {/* Sequence Mode */}
      <div>
        <h4 className="text-xs font-medium text-text mb-2">Modo de sequencia</h4>
        <div className="grid grid-cols-2 gap-2">
          {SEQUENCE_MODES.map((mode) => {
            const Icon = mode.icon
            const isSelected = config.sequenceMode === mode.value
            return (
              <motion.button
                key={mode.value}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setDirectorConfig({ sequenceMode: mode.value })}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-glow-sm'
                    : 'border-border bg-surface hover:border-border/80'
                }`}
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isSelected ? 'text-primary' : 'text-text-muted'
                  }`}
                />
                <div>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {mode.label}
                  </span>
                  <p className="text-[10px] text-text-muted mt-0.5">{mode.description}</p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Timing Rules */}
      <div>
        <h4 className="text-xs font-medium text-text mb-2">Regras de timing</h4>
        <p className="text-[10px] text-text-muted mb-2">
          Duracao variavel obrigatoria dentro da janela (proibido duracoes lineares)
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Film className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs font-medium text-text">Videos (VO3)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-text-muted">Min (s)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={config.videoMinDurationMs / 1000}
                  onChange={(e) =>
                    setDirectorConfig({
                      videoMinDurationMs: Math.round(parseFloat(e.target.value) * 1000)
                    })
                  }
                  className="mt-0.5 w-full rounded border border-border bg-bg px-2 py-1 text-xs tabular-nums text-text focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-text-muted">Max (s)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={config.videoMaxDurationMs / 1000}
                  onChange={(e) =>
                    setDirectorConfig({
                      videoMaxDurationMs: Math.round(parseFloat(e.target.value) * 1000)
                    })
                  }
                  className="mt-0.5 w-full rounded border border-border bg-bg px-2 py-1 text-xs tabular-nums text-text focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ImageIcon className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-text">Imagens (Nano Banana)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-text-muted">Min (s)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={config.imageMinDurationMs / 1000}
                  onChange={(e) =>
                    setDirectorConfig({
                      imageMinDurationMs: Math.round(parseFloat(e.target.value) * 1000)
                    })
                  }
                  className="mt-0.5 w-full rounded border border-border bg-bg px-2 py-1 text-xs tabular-nums text-text focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-text-muted">Max (s)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={config.imageMaxDurationMs / 1000}
                  onChange={(e) =>
                    setDirectorConfig({
                      imageMaxDurationMs: Math.round(parseFloat(e.target.value) * 1000)
                    })
                  }
                  className="mt-0.5 w-full rounded border border-border bg-bg px-2 py-1 text-xs tabular-nums text-text focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LLM Provider */}
      <div>
        <h4 className="text-xs font-medium text-text mb-2">Provedor LLM</h4>
        <div className="flex items-center gap-2">
          <select
            value={config.llmProvider}
            onChange={(e) =>
              setDirectorConfig({ llmProvider: e.target.value as typeof config.llmProvider })
            }
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text transition-colors focus:border-primary focus:outline-none"
          >
            {LLM_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={checkLlm}
            disabled={checkingLlm}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text-muted transition-colors hover:text-text disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingLlm ? 'animate-spin' : ''}`} />
          </button>
          {llmAvailable !== null && (
            <div
              className={`flex items-center gap-1.5 ${
                llmAvailable ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  llmAvailable ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-[10px] font-medium">
                {llmAvailable ? 'Conectado' : 'Nao instalado'}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons based on CLI state */}
        {llmAvailable === false && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[10px] text-text-muted mb-2">
              CLI nao encontrado. Instale para usar a IA na geracao de prompts.
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={installing}
                onClick={async () => {
                  setInstalling(true)
                  try {
                    await window.api.directorInstallCli(config.llmProvider)
                    addToast({
                      type: 'success',
                      message: `${LLM_PROVIDERS.find((p) => p.value === config.llmProvider)?.label} instalado com sucesso!`
                    })
                    await checkLlm()
                  } catch (err: unknown) {
                    const msg =
                      err instanceof Error ? err.message : 'Erro desconhecido na instalacao'
                    addToast({ type: 'error', message: msg })
                  } finally {
                    setInstalling(false)
                  }
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {installing ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Terminal className="h-3 w-3" />
                )}
                {installing ? 'Instalando...' : 'Instalar automaticamente'}
              </button>
              <button
                onClick={() => {
                  const provider = LLM_PROVIDERS.find((p) => p.value === config.llmProvider)
                  if (provider) window.open(provider.installUrl, '_blank')
                }}
                className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:text-text"
              >
                <ExternalLink className="h-3 w-3" />
                Docs
              </button>
            </div>
            <p className="mt-2 text-[9px] text-text-muted/60">
              Requer Node.js/npm instalado. Executa:{' '}
              <code className="text-primary/70">
                npm install -g{' '}
                {LLM_PROVIDERS.find((p) => p.value === config.llmProvider)?.npmPkg}
              </code>
            </p>
          </div>
        )}

        {llmAvailable && (
          <div className="mt-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <p className="text-[10px] text-text-muted mb-2">
              CLI instalado. Faca login para usar com sua assinatura:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-bg px-2.5 py-1.5 text-[11px] text-primary font-mono">
                {LLM_PROVIDERS.find((p) => p.value === config.llmProvider)?.loginCmd}
              </code>
              <button
                onClick={() => {
                  const cmd =
                    LLM_PROVIDERS.find((p) => p.value === config.llmProvider)?.loginCmd || ''
                  navigator.clipboard.writeText(cmd)
                  addToast({ type: 'success', message: 'Comando copiado!' })
                }}
                className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:text-text"
              >
                <Terminal className="h-3 w-3" />
                Copiar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Characters */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-text">Personagens (Character Anchors)</h4>
          <div className="flex items-center gap-1.5">
            {characterRefs.length > 0 && (
              <button
                onClick={() => setCharacterRefs([])}
                className="flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[10px] text-text-muted transition-colors hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
                Limpar
              </button>
            )}
            <button
              onClick={handleImportCharacters}
              className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary transition-all hover:bg-primary/20"
            >
              <FolderOpen className="h-3 w-3" />
              Importar pasta
            </button>
          </div>
        </div>

        {characterRefs.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface p-3">
            <Users className="h-4 w-4 text-text-muted" />
            <p className="text-[10px] text-text-muted">
              Nenhum personagem importado. Selecione uma pasta com imagens no formato
              &quot;Nome - Role, chapter(s) N&quot;.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {uniqueNames.map((name) => {
              const versions = characterRefs.filter((c) => c.name === name)
              return (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Users className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text truncate">{name}</p>
                    <p className="text-[10px] text-text-muted truncate">
                      {versions[0].role} &middot;{' '}
                      {versions
                        .map((v) =>
                          v.chapters.length > 0
                            ? `Cap ${v.chapters.join(', ')}`
                            : 'Todos os capitulos'
                        )
                        .join(' | ')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {versions.length} versao{versions.length > 1 ? 'es' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirm */}
      <div className="flex justify-end pt-2 border-t border-border">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onConfirm}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Confirmar configuracao
        </motion.button>
      </div>
    </div>
  )
}
