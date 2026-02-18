import { useStageStore } from '../../stores/useStageStore'
import { STAGE_LABELS } from '../../lib/constants'

const stages = [1, 2, 3, 4, 5, 6] as const

export function Sidebar(): React.JSX.Element {
  const { currentStage, completedStages, setCurrentStage, canNavigateTo } = useStageStore()

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-surface">
      <div className="px-4 py-5">
        <h1 className="text-sm font-semibold tracking-wide text-primary uppercase">
          Pipeline Studio
        </h1>
      </div>
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {stages.map((stage) => {
            const isActive = currentStage === stage
            const isCompleted = completedStages.has(stage)
            const isAvailable = canNavigateTo(stage)

            return (
              <li key={stage}>
                <button
                  onClick={() => setCurrentStage(stage)}
                  disabled={!isAvailable}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : isCompleted
                        ? 'text-text hover:bg-surface-hover'
                        : isAvailable
                          ? 'text-text-muted hover:bg-surface-hover hover:text-text'
                          : 'cursor-not-allowed text-text-muted/40'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                      isActive
                        ? 'bg-primary text-white ring-2 ring-primary/30'
                        : isCompleted
                          ? 'bg-success text-white'
                          : isAvailable
                            ? 'border border-border text-text-muted'
                            : 'border border-border/40 text-text-muted/40'
                    }`}
                  >
                    {isCompleted ? '\u2713' : stage}
                  </span>
                  <span>{STAGE_LABELS[stage]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <button
          onClick={() => useStageStore.getState().reset()}
          className="w-full rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
        >
          Configuracoes
        </button>
      </div>
    </aside>
  )
}
