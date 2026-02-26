import { useEffect, useRef, useState } from 'react'
import { ListOrdered } from 'lucide-react'
import { useVeo3AutomationStore, DEFAULT_TAB_AUTOMATION } from '@/stores/useVeo3AutomationStore'
import type { FlowCommand, FlowCreationMode, FlowCharacterImageRef } from '@/types/veo3'

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

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-white/10 text-text-muted',
  sending: 'bg-yellow-500/15 text-yellow-400',
  submitted: 'bg-yellow-500/15 text-yellow-400',
  generating: 'bg-blue-500/15 text-blue-400',
  done: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  skipped: 'bg-white/5 text-text-muted'
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
          className="h-4 w-4 shrink-0 rounded-sm object-cover"
        />
      )}
      <span className="text-[9px] text-text-muted">{ci.name}</span>
    </div>
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
  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors ${
        isActive
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-bg hover:border-border/80'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-mono text-text-muted">
          #{String(command.sceneIndex + 1).padStart(2, '0')}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${MODE_COLORS[command.mode]}`}>
          {MODE_LABELS[command.mode]}
        </span>
        <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ${STATUS_COLORS[command.status]}`}>
          {command.status}
        </span>
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-text-muted">
        {command.prompt}
      </p>

      {command.characterImages.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
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
        </span>
        <button
          onClick={loadFromProject}
          className="text-[10px] text-primary transition-colors hover:text-primary-hover"
        >
          Recarregar
        </button>
      </div>

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
