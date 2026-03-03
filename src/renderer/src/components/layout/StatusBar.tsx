import { useEffect, useState } from 'react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useLogStore, selectLastLog, selectErrorCount } from '@/stores/useLogStore'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

const LOG_TYPE_COLORS = {
  info: 'text-primary-light',
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning'
}

export function StatusBar(): React.JSX.Element {
  const { capCutDraftPath } = useProjectStore()
  const logs = useLogStore((s) => s.logs)
  const lastLog = selectLastLog(logs)
  const errorCount = selectErrorCount(logs)
  const { activeWorkspace } = useWorkspaceStore()
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.updaterGetVersion().then(setAppVersion).catch(() => {})
  }, [])

  return (
    <footer className="flex h-8 items-center justify-between border-t border-border bg-bg px-4 text-[11px] text-text-muted">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {lastLog && (
          <span className={`min-w-0 truncate ${LOG_TYPE_COLORS[lastLog.type]}`}>
            {lastLog.message}
          </span>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {errorCount > 0 && (
          <span className="text-error">
            {errorCount} erro{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {activeWorkspace && (
          <span className="truncate text-text-tertiary">
            {activeWorkspace.name}
          </span>
        )}
        <span className="max-w-[300px] truncate font-mono text-text-tertiary">
          {capCutDraftPath || 'Nenhum projeto'}
        </span>
        {appVersion && (
          <span className="font-mono text-text-tertiary">v{appVersion}</span>
        )}
      </div>
    </footer>
  )
}
