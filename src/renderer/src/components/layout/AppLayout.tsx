import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '@/stores/useUIStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'
import { WorkspaceSelectorScreen } from './WorkspaceSelectorScreen'
import { PipelineWorkspace } from './PipelineWorkspace'
import { ProjectDashboard } from '../projects/ProjectDashboard'
import { SettingsModal } from '../shared/SettingsModal'
import { HealthCheckModal } from '../shared/HealthCheckModal'

export function AppLayout(): React.JSX.Element {
  const { currentView, setCurrentView } = useUIStore()
  const { activeWorkspaceId, activeWorkspace, loadRegistry, openWorkspace } = useWorkspaceStore()

  // Once pipeline is opened, keep it mounted forever to preserve webviews
  const [pipelineActivated, setPipelineActivated] = useState(false)
  const [showHealthCheck, setShowHealthCheck] = useState(true)

  useEffect(() => {
    if (currentView === 'pipeline') setPipelineActivated(true)
  }, [currentView])

  // Auto-restore workspace on mount (like NardotoStudio App.tsx:97-110)
  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadRegistry()
      if (activeWorkspaceId && !activeWorkspace) {
        try {
          await openWorkspace(activeWorkspaceId)
          setCurrentView('projectDashboard')
        } catch {
          setCurrentView('workspaceSelector')
        }
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isPipeline = currentView === 'pipeline'

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      {/* Non-pipeline views: normal animated transitions */}
      <AnimatePresence mode="wait">
        {currentView === 'workspaceSelector' && (
          <motion.div
            key="workspaceSelector"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <WorkspaceSelectorScreen />
          </motion.div>
        )}
        {currentView === 'projectDashboard' && (
          <motion.div
            key="projectDashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <ProjectDashboard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pipeline: always mounted once activated, shown/hidden via CSS to preserve webviews */}
      {pipelineActivated && (
        <div
          className={`absolute inset-0 ${isPipeline ? 'z-10' : 'pointer-events-none invisible'}`}
        >
          <PipelineWorkspace />
        </div>
      )}

      <SettingsModal />
      {showHealthCheck && (
        <HealthCheckModal onDismiss={() => setShowHealthCheck(false)} />
      )}
    </div>
  )
}
