import { useStageStore } from '../../stores/useStageStore'
import { STAGE_LABELS, STAGE_DESCRIPTIONS } from '../../lib/constants'

export function StageHeader(): React.JSX.Element {
  const { currentStage } = useStageStore()

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div>
        <h2 className="text-base font-semibold text-text">
          Etapa {currentStage}: {STAGE_LABELS[currentStage]}
        </h2>
        <p className="text-xs text-text-muted">{STAGE_DESCRIPTIONS[currentStage]}</p>
      </div>
    </header>
  )
}
