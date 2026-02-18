import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'

interface DraftSelectorProps {
  onDraftLoaded: () => void
}

export function DraftSelector({ onDraftLoaded }: DraftSelectorProps): React.JSX.Element {
  const { capCutDraftPath, setCapCutDraftPath } = useProjectStore()
  const { addToast, setLoading } = useUIStore()

  const handleSelectDraft = async (): Promise<void> => {
    try {
      const draftPath = await window.api.selectCapCutDraft()
      if (!draftPath) return
      setCapCutDraftPath(draftPath)
      addToast({ type: 'success', message: 'Projeto CapCut selecionado.' })
    } catch (err) {
      addToast({ type: 'error', message: 'Erro ao selecionar projeto CapCut.' })
    }
  }

  const handleLoadDraft = async (): Promise<void> => {
    if (!capCutDraftPath) return

    try {
      setLoading(true, 'Lendo projeto CapCut...')
      await window.api.readCapCutDraft(capCutDraftPath)
      setLoading(false)
      addToast({ type: 'success', message: 'Projeto CapCut carregado.' })
      onDraftLoaded()
    } catch (err) {
      setLoading(false)
      addToast({ type: 'error', message: 'Erro ao ler projeto CapCut.' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text">Projeto CapCut</h3>
        <p className="text-xs text-text-muted mt-1">
          Selecione a pasta do projeto CapCut que contem o draft_content.json
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted truncate">
          {capCutDraftPath || 'Nenhum projeto selecionado'}
        </div>
        <button
          onClick={handleSelectDraft}
          className="shrink-0 rounded-md border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Selecionar
        </button>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleLoadDraft}
          disabled={!capCutDraftPath}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Carregar audio
        </button>
      </div>
    </div>
  )
}
