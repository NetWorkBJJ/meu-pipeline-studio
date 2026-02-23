import { AppLayout } from './components/layout/AppLayout'
import { ToastContainer } from './components/shared/Toast'
import { useStageStore } from './stores/useStageStore'
import { useProjectStore } from './stores/useProjectStore'
import { useDirectorPersistence } from './hooks/useDirectorPersistence'

// Expose Zustand stores on window for E2E testing
;(window as unknown as Record<string, unknown>).__ZUSTAND_STORES__ = {
  stageStore: useStageStore,
  projectStore: useProjectStore
}

export function App(): React.JSX.Element {
  useDirectorPersistence()

  return (
    <>
      <AppLayout />
      <ToastContainer />
    </>
  )
}
