import { useEffect, useRef } from 'react'
import { ListOrdered, Loader2 } from 'lucide-react'
import { useVeo3AutomationStore } from '@/stores/useVeo3AutomationStore'
import type { FlowCommand, FlowCreationMode } from '@/types/veo3'

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

function CommandCard({
  command,
  isActive
}: {
  command: FlowCommand
  isActive: boolean
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
            <span
              key={ci.characterId}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-text-muted"
            >
              {ci.name}
            </span>
          ))}
        </div>
      )}

      {command.error && (
        <p className="mt-1 text-[10px] text-red-400">{command.error}</p>
      )}
    </div>
  )
}

export function SidepanelPlanTab(): React.JSX.Element {
  const { commands, currentCommandIndex, isRunning, loadFromProject } =
    useVeo3AutomationStore()
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
          <CommandCard command={cmd} isActive={i === currentCommandIndex && isRunning} />
        </div>
      ))}
    </div>
  )
}
