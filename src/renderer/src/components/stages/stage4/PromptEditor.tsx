import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, Copy, Check } from 'lucide-react'

interface PromptEditorProps {
  prompt: string
  onChange: (prompt: string) => void
  onRegenerate?: () => void
  isRegenerating?: boolean
  label?: string
}

export function PromptEditor({
  prompt,
  onChange,
  onRegenerate,
  isRegenerating = false,
  label
}: PromptEditorProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-lg border border-border bg-bg/50 p-2">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-text-muted">{label}</span>
          <div className="flex items-center gap-1">
            {onRegenerate && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:text-primary disabled:opacity-40"
                title="Regenerar prompt"
              >
                <RefreshCw
                  className={`h-2.5 w-2.5 ${isRegenerating ? 'animate-spin' : ''}`}
                />
                Regenerar
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              disabled={!prompt}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:text-text disabled:opacity-40"
              title="Copiar prompt"
            >
              {copied ? (
                <Check className="h-2.5 w-2.5 text-success" />
              ) : (
                <Copy className="h-2.5 w-2.5" />
              )}
            </motion.button>
          </div>
        </div>
      )}
      <textarea
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Prompt sera gerado pelo LLM..."
        rows={3}
        className="w-full rounded border border-border/50 bg-bg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/30 transition-colors focus:border-primary focus:outline-none resize-y"
      />
    </div>
  )
}
