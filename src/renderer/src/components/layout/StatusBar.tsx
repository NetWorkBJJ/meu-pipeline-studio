import { motion } from 'framer-motion'
import { useProjectStore } from '@/stores/useProjectStore'
import { useLogStore, selectLastLog, selectErrorCount } from '@/stores/useLogStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

const LOG_TYPE_COLORS = {
  info: 'text-blue-400',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400'
}

export function StatusBar(): React.JSX.Element {
  const { capCutDraftPath } = useProjectStore()
  const logs = useLogStore((s) => s.logs)
  const lastLog = selectLastLog(logs)
  const errorCount = selectErrorCount(logs)
  const { activeWorkspace } = useWorkspaceStore()

  return (
    <footer className="flex items-center justify-between border-t border-border bg-bg px-4 py-1.5 text-[11px] text-text-muted">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <motion.span
            animate={
              capCutDraftPath
                ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }
                : { scale: 1, opacity: 0.4 }
            }
            transition={capCutDraftPath ? { duration: 2, repeat: Infinity } : {}}
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              capCutDraftPath ? 'bg-success' : 'bg-text-muted'
            }`}
          />
          <span className={capCutDraftPath ? 'text-success' : 'text-text-muted/50'}>
            {capCutDraftPath ? 'Conectado' : 'Desconectado'}
          </span>
        </span>

        {lastLog && (
          <span className={`min-w-0 truncate ${LOG_TYPE_COLORS[lastLog.type]}`}>
            {lastLog.message}
          </span>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {errorCount > 0 && (
          <span className="text-red-400">
            {errorCount} erro{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {activeWorkspace && (
          <span className="truncate text-text-muted/60">
            {activeWorkspace.name}
          </span>
        )}
        <span className="max-w-[300px] truncate font-mono text-text-muted/60">
          {capCutDraftPath || 'Nenhum projeto'}
        </span>
      </div>
    </footer>
  )
}
