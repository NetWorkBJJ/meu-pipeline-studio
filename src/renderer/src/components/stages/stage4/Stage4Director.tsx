import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Film, CheckCircle2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useStageStore } from '@/stores/useStageStore'
import { useUIStore } from '@/stores/useUIStore'
import { msToDisplay } from '@/lib/time'
import { DirectorStepper } from './DirectorStepper'
import type { DirectorStep } from './DirectorStepper'
import { DirectorConfigPanel } from './DirectorConfigPanel'
import { ScenePlannerPanel } from './ScenePlannerPanel'
import { PromptStudio } from './PromptStudio'
import { MediaImporter } from './MediaImporter'

const STEP_ANIMATION = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 }
}

export function Stage4Director(): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<DirectorStep>(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const videoSegments = useProjectStore((s) => s.videoSegments)
  const scenes = useProjectStore((s) => s.scenes)
  const projectLoaded = useProjectStore((s) => s.projectLoaded)
  const completedStages = useStageStore((s) => s.completedStages)
  const { completeStage } = useStageStore()
  const { addToast } = useUIStore()

  const hasExistingVideos = projectLoaded && videoSegments.length > 0
  const stageAlreadyComplete = completedStages.has(4)

  // Auto-detect restored scenes and jump to PromptStudio (step 2)
  useEffect(() => {
    const hasPrompts = scenes.some((s) => s.prompt.trim())
    if (hasPrompts && currentStep === 0) {
      setCompletedSteps(new Set([0, 1]))
      setCurrentStep(2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCompleteStep = useCallback((step: DirectorStep) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      next.add(step)
      return next
    })
    if (step < 3) {
      setCurrentStep((step + 1) as DirectorStep)
    }
  }, [])

  const handleSkipWithVideos = (): void => {
    completeStage(4)
    addToast({
      type: 'success',
      message: `${videoSegments.length} videos existentes na timeline. Etapa 4 concluida.`
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text">Direcao de Cenas</h3>
        <p className="text-xs text-text-muted mt-1">
          Configure, planeje cenas, gere prompts e importe midias.
        </p>
      </div>

      {/* Existing videos shortcut */}
      {hasExistingVideos && !stageAlreadyComplete && scenes.length === 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Film className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-text">
                {videoSegments.length} videos ja existem na timeline
              </h3>
              <p className="mt-1 text-xs text-text-muted">
                O projeto CapCut ja possui midias posicionadas. Voce pode pular o agrupamento
                ou criar cenas para reorganizar.
              </p>
              <div className="mt-3 max-h-32 overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <tbody>
                    {videoSegments.slice(0, 5).map((v) => (
                      <tr key={v.id} className="border-b border-border/30 last:border-0">
                        <td className="w-8 px-2 py-1.5 text-text-muted">{v.index}</td>
                        <td className="max-w-0 truncate px-2 py-1.5 font-mono text-text-muted">
                          {v.filePath.split(/[/\\]/).pop() || 'Video'}
                        </td>
                        <td className="w-14 px-2 py-1.5 text-right text-text-muted">
                          {v.mediaType}
                        </td>
                        <td className="w-16 px-2 py-1.5 text-right font-mono text-text-muted">
                          {msToDisplay(v.durationMs)}
                        </td>
                      </tr>
                    ))}
                    {videoSegments.length > 5 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-1.5 text-center text-text-muted">
                          +{videoSegments.length - 5} videos...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSkipWithVideos}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Manter videos existentes
            </button>
          </div>
        </div>
      )}

      {/* Director Stepper */}
      <DirectorStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={setCurrentStep}
      />

      {/* Step content */}
      <AnimatePresence mode="wait">
        {currentStep === 0 && (
          <motion.div key="config" {...STEP_ANIMATION}>
            <DirectorConfigPanel onConfirm={() => handleCompleteStep(0)} />
          </motion.div>
        )}
        {currentStep === 1 && (
          <motion.div key="planner" {...STEP_ANIMATION}>
            <ScenePlannerPanel onConfirm={() => handleCompleteStep(1)} />
          </motion.div>
        )}
        {currentStep === 2 && (
          <motion.div key="prompts" {...STEP_ANIMATION}>
            <PromptStudio onConfirm={() => handleCompleteStep(2)} />
          </motion.div>
        )}
        {currentStep === 3 && (
          <motion.div key="import" {...STEP_ANIMATION}>
            <MediaImporter />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
