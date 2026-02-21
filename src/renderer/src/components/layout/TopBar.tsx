import { Home, Settings, ChevronRight } from 'lucide-react'
import { CapCutIcon } from '@/components/shared/CapCutIcon'
import { motion } from 'framer-motion'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { useStageStore } from '@/stores/useStageStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

function extractProjectFolder(path: string | null): string {
  if (!path) return 'Sem projeto'
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  // Return parent folder (project ID), not the filename (draft_content.json)
  return parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1] || 'Projeto'
}

export function TopBar(): React.JSX.Element {
  const { capCutDraftPath, projectSummary, resetProject } = useProjectStore()
  const { setCurrentView, setSettingsOpen, addToast } = useUIStore()
  const { reset } = useStageStore()
  const { activeWorkspace } = useWorkspaceStore()

  const handleGoHome = (): void => {
    resetProject()
    reset()
    setCurrentView('projectDashboard')
  }

  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-bg px-3">
      <div className="flex items-center gap-2">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleGoHome}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text"
          title="Voltar ao dashboard"
        >
          <Home className="h-4 w-4" />
        </motion.button>
        <div className="h-4 w-px bg-border" />
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          {activeWorkspace && (
            <>
              <span className="text-text-muted">{activeWorkspace.name}</span>
              <ChevronRight className="h-3 w-3 text-text-muted/50" />
            </>
          )}
          <span className="font-medium text-text" title={capCutDraftPath || undefined}>
            {projectSummary?.name || extractProjectFolder(capCutDraftPath)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={async () => {
            const result = await window.api.openCapCut()
            if (!result.success) {
              addToast({ type: 'error', message: result.error || 'Erro ao abrir CapCut.' })
            }
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text"
          title="Abrir CapCut"
        >
          <CapCutIcon className="h-4 w-4" />
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSettingsOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text"
          title="Configuracoes"
        >
          <Settings className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  )
}
