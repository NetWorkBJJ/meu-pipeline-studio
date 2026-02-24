export type DirectorStep = 0 | 1 | 2 | 3 | 4

interface DirectorStepperProps {
  currentStep: DirectorStep
  completedSteps: Set<number>
  onStepClick: (step: DirectorStep) => void
}

const STEPS = ['Configuracao', 'Planejamento', 'Prompts', 'Importacao', 'Insercao']

export function DirectorStepper({
  currentStep,
  completedSteps,
  onStepClick
}: DirectorStepperProps): React.JSX.Element {
  return (
    <div className="flex items-center rounded-lg border border-border bg-surface px-4 py-3">
      {STEPS.map((label, index) => {
        const isCompleted = completedSteps.has(index)
        const isCurrent = currentStep === index
        const isAccessible = isCompleted || index === 0 || completedSteps.has(index - 1)

        return (
          <div key={index} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => isAccessible && onStepClick(index as DirectorStep)}
              disabled={!isAccessible}
              className="flex items-center gap-1.5"
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  isCurrent
                    ? 'bg-primary text-white'
                    : isCompleted
                      ? 'bg-success text-white'
                      : 'bg-border-light text-text-muted'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`text-xs transition-colors ${
                  isCurrent
                    ? 'font-semibold text-primary'
                    : isCompleted
                      ? 'font-semibold text-success'
                      : 'text-text-muted'
                }`}
              >
                {label}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-3 h-px flex-1 max-w-8 ${
                  completedSteps.has(index) ? 'bg-success' : 'bg-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
