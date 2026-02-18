import { useProjectStore } from '@/stores/useProjectStore'

interface ScriptInputProps {
  onSplit: () => void
}

export function ScriptInput({ onSplit }: ScriptInputProps): React.JSX.Element {
  const { rawScript, setRawScript } = useProjectStore()

  const charCount = rawScript.length
  const wordCount = rawScript.trim() ? rawScript.trim().split(/\s+/).length : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text">Roteiro</label>
        <span className="text-xs text-text-muted">
          {charCount} caracteres | {wordCount} palavras
        </span>
      </div>
      <textarea
        value={rawScript}
        onChange={(e) => setRawScript(e.target.value)}
        placeholder="Cole ou digite o roteiro aqui..."
        rows={12}
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          onClick={onSplit}
          disabled={!rawScript.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Dividir em blocos
        </button>
      </div>
    </div>
  )
}