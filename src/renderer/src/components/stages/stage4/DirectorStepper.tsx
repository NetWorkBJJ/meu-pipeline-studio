import { motion } from 'framer-motion'
import { Settings, LayoutGrid, Sparkles, Import } from 'lucide-react'

export type DirectorStep = 0 | 1 | 2 | 3

interface DirectorStepperProps {
  currentStep: DirectorStep
  completedSteps: Set<number>
  onStepClick: (step: DirectorStep) => void
}

const STEPS = [
  { label: 'Configuracao', icon: Settings },
  { label: 'Planejamento', icon: LayoutGrid },
  { label: 'Prompts', icon: Sparkles },
  { label: 'Importacao', icon: Import }
]

export function DirectorStepper({
  currentStep,
  completedSteps,
  onStepClick
}: DirectorStepperProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.has(index)
        const isCurrent = currentStep === index
        const isAccessible = isCompleted || index === 0 || completedSteps.has(index - 1)
        const Icon = step.icon

        return (
          <div key={index} className="flex items-center">
            <motion.button
              whileHover={isAccessible ? { scale: 1.02 } : undefined}
              whileTap={isAccessible ? { scale: 0.98 } : undefined}
              onClick={() => isAccessible && onStepClick(index as DirectorStep)}
              disabled={!isAccessible}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                isCurrent
                  ? 'bg-primary text-white shadow-glow-sm'
                  : isCompleted
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : isAccessible
                      ? 'bg-surface text-text-muted hover:bg-surface/80'
                      : 'cursor-not-allowed bg-surface/50 text-text-muted/30'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {step.label}
            </motion.button>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-1 h-px w-4 ${
                  completedSteps.has(index) ? 'bg-primary/50' : 'bg-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
