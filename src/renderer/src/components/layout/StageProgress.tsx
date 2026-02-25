import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { useStageStore } from '@/stores/useStageStore'
import { STAGE_LABELS, STAGE_DESCRIPTIONS } from '@/lib/constants'

const stages = [1, 2, 3, 4, 5] as const

export function StageProgress(): React.JSX.Element {
  const { currentStage, completedStages, setCurrentStage, canNavigateTo } = useStageStore()

  return (
    <div className="flex items-center justify-center gap-0 border-b border-border bg-surface px-10 py-3">
      {stages.map((stage, i) => {
        const isActive = currentStage === stage
        const isCompleted = completedStages.has(stage)
        const isAvailable = canNavigateTo(stage)
        const isVeo3 = stage === 5

        return (
          <Fragment key={stage}>
            {i > 0 && (
              <div
                className={`h-0.5 rounded-sm flex-1 max-w-20 transition-colors duration-300 ${
                  completedStages.has(stages[i - 1]) ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
            <motion.button
              type="button"
              whileHover={isAvailable ? { scale: 1.08 } : {}}
              whileTap={isAvailable ? { scale: 0.95 } : {}}
              onClick={() => setCurrentStage(stage)}
              disabled={!isAvailable}
              className="flex flex-col items-center gap-1.5 px-2"
              title={STAGE_DESCRIPTIONS[stage]}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                  isActive
                    ? isVeo3
                      ? 'bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-glow-sm'
                      : 'gradient-primary text-white shadow-glow-sm'
                    : isCompleted
                      ? isVeo3
                        ? 'bg-blue-500 text-white'
                        : 'bg-primary text-white'
                      : 'border-2 border-border-light text-text-tertiary'
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isVeo3 ? (
                  <Sparkles className="h-3.5 w-3.5" />
                ) : (
                  stage
                )}
              </div>
              <span
                className={`text-[11px] font-medium transition-colors duration-300 ${
                  isActive
                    ? isVeo3
                      ? 'text-blue-400'
                      : 'text-primary-light'
                    : isCompleted
                      ? 'text-text'
                      : 'text-text-tertiary'
                }`}
              >
                {STAGE_LABELS[stage]}
              </span>
            </motion.button>
          </Fragment>
        )
      })}
    </div>
  )
}
