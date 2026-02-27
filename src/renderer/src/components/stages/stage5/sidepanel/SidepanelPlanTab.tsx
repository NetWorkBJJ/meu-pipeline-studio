import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Film,
  ImageIcon,
  ListOrdered,
  Loader2,
  MinusCircle,
  RotateCw,
  Sparkles,
  XCircle
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useVeo3AutomationStore, DEFAULT_TAB_AUTOMATION } from '@/stores/useVeo3AutomationStore'
import type { FlowCommand, FlowCreationMode, FlowCommandStatus, FlowCharacterImageRef } from '@/types/veo3'

const MODE_LABELS: Record<FlowCreationMode, string> = {
  texto: 'Text',
  elementos: 'Elements',
  imagem: 'Image'
}

const MODE_COLORS: Record<FlowCreationMode, string> = {
  texto: 'bg-blue-500/15 text-blue-400',
  elementos: 'bg-violet-500/15 text-violet-400',
  imagem: 'bg-amber-500/15 text-amber-400'
}

const MODE_ICONS: Record<FlowCreationMode, LucideIcon> = {
  texto: Film,
  elementos: Sparkles,
  imagem: ImageIcon
}

const STATUS_LABELS: Record<FlowCommandStatus, string> = {
  queued: 'Na fila',
  sending: 'Enviando',
  submitted: 'Enviado',
  generating: 'Gerando',
  done: 'Concluido',
  failed: 'Falhou',
  skipped: 'Pulado',
  retrying: 'Tentando'
}

const STATUS_COLORS: Record<FlowCommandStatus, string> = {
  queued: 'text-text-muted',
  sending: 'text-yellow-400',
  submitted: 'text-yellow-400',
  generating: 'text-blue-400',
  done: 'text-green-400',
  failed: 'text-red-400',
  skipped: 'text-text-muted',
  retrying: 'text-orange-400'
}

const STATUS_ICONS: Record<FlowCommandStatus, LucideIcon> = {
  queued: Circle,
  sending: Loader2,
  submitted: Loader2,
  generating: Loader2,
  done: CheckCircle2,
  failed: XCircle,
  skipped: MinusCircle,
  retrying: RotateCw
}

const STATUS_SPIN: Record<FlowCommandStatus, boolean> = {
  queued: false,
  sending: true,
  submitted: true,
  generating: true,
  done: false,
  failed: false,
  skipped: false,
  retrying: true
}

function getCardStyles(status: FlowCommandStatus, isActive: boolean): string {
  if (isActive) {
    return 'border-primary/50 bg-primary/5'
  }
  switch (status) {
    case 'done':
      return 'border-green-500/30 bg-green-500/3'
    case 'failed':
      return 'border-red-500/30 bg-red-500/3'
    case 'sending':
    case 'submitted':
      return 'border-yellow-500/30 bg-yellow-500/3'
    case 'generating':
      return 'border-blue-500/30 bg-blue-500/3'
    case 'retrying':
      return 'border-orange-500/30 bg-orange-500/3'
    default:
      return 'border-border bg-bg hover:border-border/80'
  }
}

function getLeftBorderColor(status: FlowCommandStatus, isActive: boolean): string {
  if (isActive) return 'border-l-primary'
  switch (status) {
    case 'done':
      return 'border-l-green-500/60'
    case 'failed':
      return 'border-l-red-500/60'
    case 'sending':
    case 'submitted':
      return 'border-l-yellow-500/60'
    case 'generating':
      return 'border-l-blue-500/60'
    case 'retrying':
      return 'border-l-orange-500/60'
    default:
      return 'border-l-border'
  }
}

function CharacterBadge({
  ci,
  thumbnail
}: {
  ci: FlowCharacterImageRef
  thumbnail: string | undefined
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5">
      {thumbnail && (
        <img
          src={thumbnail}
          alt={ci.name}
          className="h-5 w-5 shrink-0 rounded-sm object-cover"
        />
      )}
      <span className="text-[9px] text-text-muted">{ci.name}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: FlowCommandStatus }): React.JSX.Element {
  const Icon = STATUS_ICONS[status]
  const spin = STATUS_SPIN[status]
  const color = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]

  return (
    <span className={`flex items-center gap-1 shrink-0 text-[9px] font-medium ${color}`}>
      <Icon className={`h-3 w-3 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </span>
  )
}

function CommandCard({
  command,
  isActive,
  thumbnails
}: {
  command: FlowCommand
  isActive: boolean
  thumbnails: Map<string, string>
}): React.JSX.Element {
  const ModeIcon = MODE_ICONS[command.mode]
  const isDone = command.status === 'done'
  const cardStyles = getCardStyles(command.status, isActive)
  const leftBorder = getLeftBorderColor(command.status, isActive)

  const card = (
    <div
      className={`rounded-lg border border-l-2 p-2.5 transition-colors ${leftBorder} ${cardStyles}`}
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 text-[10px] font-mono ${isDone ? 'text-green-500/60' : 'text-text-muted'}`}>
          #{String(command.sceneIndex + 1).padStart(2, '0')}
        </span>
        <span className={`flex items-center gap-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${MODE_COLORS[command.mode]} ${isDone ? 'opacity-50' : ''}`}>
          <ModeIcon className="h-2.5 w-2.5" />
          {MODE_LABELS[command.mode]}
        </span>
        <span className="ml-auto">
          <StatusBadge status={command.status} />
        </span>
      </div>

      <p className={`mt-1.5 line-clamp-2 text-[11px] leading-relaxed ${isDone ? 'text-text-muted/50' : 'text-text-muted'}`}>
        {command.prompt}
      </p>

      {command.characterImages.length > 0 && (
        <div className={`mt-1.5 flex flex-wrap gap-1 ${isDone ? 'opacity-50' : ''}`}>
          {command.characterImages.map((ci) => (
            <CharacterBadge
              key={ci.characterId}
              ci={ci}
              thumbnail={ci.imagePath ? thumbnails.get(ci.imagePath) : undefined}
            />
          ))}
        </div>
      )}

      {command.error && (
        <p className="mt-1 text-[10px] text-red-400">{command.error}</p>
      )}
    </div>
  )

  if (isActive) {
    return (
      <motion.div
        animate={{ opacity: [1, 0.8, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        {card}
      </motion.div>
    )
  }

  return card
}

function useCharacterThumbnails(commands: FlowCommand[]): Map<string, string> {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const paths = new Set<string>()
    for (const cmd of commands) {
      for (const ci of cmd.characterImages) {
        if (ci.imagePath) paths.add(ci.imagePath)
      }
    }

    if (paths.size === 0) return

    let cancelled = false
    const loadThumbnails = async (): Promise<void> => {
      const map = new Map<string, string>()
      for (const path of paths) {
        if (cancelled) break
        try {
          const dataUrl = await window.api.veo3ReadImageAsDataUrl(path)
          if (dataUrl) map.set(path, dataUrl)
        } catch {
          // Skip failed loads
        }
      }
      if (!cancelled) setThumbnails(map)
    }

    loadThumbnails()
    return () => { cancelled = true }
  }, [commands.length])

  return thumbnails
}

function ProgressBar({ commands }: { commands: FlowCommand[] }): React.JSX.Element | null {
  const done = commands.filter((c) => c.status === 'done').length
  const failed = commands.filter((c) => c.status === 'failed').length
  const inProgress = commands.filter((c) =>
    c.status === 'sending' || c.status === 'submitted' || c.status === 'generating' || c.status === 'retrying'
  ).length
  const total = commands.length

  if (done === 0 && failed === 0 && inProgress === 0) return null

  const donePercent = total > 0 ? (done / total) * 100 : 0
  const failedPercent = total > 0 ? (failed / total) * 100 : 0

  return (
    <div className="flex flex-col gap-1 pb-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className="flex h-full">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${donePercent}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${failedPercent}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-green-400">{done}/{total} concluidos</span>
        {failed > 0 && <span className="text-red-400">{failed} {failed === 1 ? 'falha' : 'falhas'}</span>}
        {inProgress > 0 && <span className="text-yellow-400">{inProgress} em andamento</span>}
      </div>
    </div>
  )
}

interface SidepanelPlanTabProps {
  tabId: string | null
}

export function SidepanelPlanTab({ tabId }: SidepanelPlanTabProps): React.JSX.Element {
  const { tabStates, loadFromProject, getFilteredCommands } = useVeo3AutomationStore()
  const tabState = (tabId ? tabStates[tabId] : null) || DEFAULT_TAB_AUTOMATION
  const { currentCommandIndex, isRunning } = tabState
  const commands = getFilteredCommands(tabId)
  const thumbnails = useCharacterThumbnails(commands)

  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isRunning && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentCommandIndex, isRunning])

  if (commands.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        <div className="rounded-full bg-white/5 p-3">
          <ListOrdered className="h-5 w-5 text-text-muted" />
        </div>
        <p className="text-center text-xs text-text-muted">
          Nenhum plano carregado. Carregue as cenas do Stage 4 para iniciar.
        </p>
        <button
          onClick={loadFromProject}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Carregar Plano
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-3">
      <div className="flex items-center justify-between pb-1">
        <span className="text-[11px] font-medium text-text-muted">
          {commands.length} cenas no plano
          {(() => {
            const txt = commands.filter((c) => c.mode === 'texto').length
            const elem = commands.filter((c) => c.mode === 'elementos').length
            const img = commands.filter((c) => c.mode === 'imagem').length
            const parts: string[] = []
            if (txt > 0) parts.push(`${txt} txt`)
            if (elem > 0) parts.push(`${elem} elem`)
            if (img > 0) parts.push(`${img} img`)
            return parts.length > 1 ? ` (${parts.join(', ')})` : ''
          })()}
        </span>
        <button
          onClick={loadFromProject}
          className="text-[10px] text-primary transition-colors hover:text-primary-hover"
        >
          Recarregar
        </button>
      </div>

      <ProgressBar commands={commands} />

      {commands.map((cmd, i) => (
        <div
          key={cmd.id}
          ref={i === currentCommandIndex && isRunning ? activeRef : undefined}
        >
          <CommandCard
            command={cmd}
            isActive={i === currentCommandIndex && isRunning}
            thumbnails={thumbnails}
          />
        </div>
      ))}
    </div>
  )
}
