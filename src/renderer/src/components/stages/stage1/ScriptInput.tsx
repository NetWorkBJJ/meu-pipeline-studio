import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { ClickUpImportModal } from '@/components/clickup/ClickUpImportModal'

interface ScriptInputProps {
  onSplit: () => void
}

export function ScriptInput({ onSplit }: ScriptInputProps): React.JSX.Element {
  const { rawScript, setRawScript, clickUpTaskRef } = useProjectStore()
  const [clickUpOpen, setClickUpOpen] = useState(false)

  const charCount = rawScript.length
  const wordCount = rawScript.trim() ? rawScript.trim().split(/\s+/).length : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-text">Roteiro</label>
          {clickUpTaskRef && (
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              via ClickUp: {clickUpTaskRef.taskName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setClickUpOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-primary/30 hover:text-text"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Importar do ClickUp
          </button>
          <span className="text-xs text-text-muted">
            {charCount} caracteres | {wordCount} palavras
          </span>
        </div>
      </div>
      <textarea
        value={rawScript}
        onChange={(e) => setRawScript(e.target.value)}
        placeholder="Cole ou digite o roteiro aqui..."
        rows={12}
        className="w-full resize-y rounded-lg border border-border bg-bg px-4 py-3 text-sm leading-relaxed text-text placeholder:text-text-muted/40 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
      />
      <div className="flex justify-end">
        <button
          onClick={onSplit}
          disabled={!rawScript.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-surface transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Dividir em blocos
        </button>
      </div>

      {clickUpOpen && (
        <ClickUpImportModal onClose={() => setClickUpOpen(false)} />
      )}
    </div>
  )
}
