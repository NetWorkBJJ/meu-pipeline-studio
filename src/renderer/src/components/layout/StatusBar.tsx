import { useProjectStore } from '../../stores/useProjectStore'

export function StatusBar(): React.JSX.Element {
  const { capCutDraftPath } = useProjectStore()

  return (
    <footer className="flex items-center justify-between border-t border-border bg-surface px-4 py-1.5 text-xs text-text-muted">
      <span className="truncate">
        {capCutDraftPath ? capCutDraftPath : 'Nenhum projeto CapCut selecionado'}
      </span>
      <span className={capCutDraftPath ? 'text-success' : 'text-text-muted/50'}>
        {capCutDraftPath ? 'Conectado' : 'Desconectado'}
      </span>
    </footer>
  )
}
