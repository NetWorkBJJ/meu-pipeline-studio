import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { TtsProgressEvent, TtsChunkResult } from '@/types/tts'

interface TTSProgressProps {
  progress: TtsProgressEvent | null
  parts: TtsChunkResult[]
  totalChunks: number
}

export function TTSProgress({
  progress,
  parts,
  totalChunks
}: TTSProgressProps): React.JSX.Element {
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div className="flex flex-col gap-3">
      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>{progress?.message || 'Preparando...'}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Chunk status list */}
      {totalChunks > 0 && (
        <div className="flex flex-col gap-1">
          {Array.from({ length: totalChunks }, (_, i) => {
            const part = parts.find((p) => p.index === i)
            const status = part?.status
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md bg-surface/50 px-2.5 py-1.5 text-xs"
              >
                {status === 'ok' ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : status === 'error' ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
                )}
                <span className="text-text-muted">Parte {i + 1}</span>
                {part?.duration_ms ? (
                  <span className="ml-auto font-mono text-text-muted/70">
                    {(part.duration_ms / 1000).toFixed(1)}s
                  </span>
                ) : part?.error ? (
                  <span className="ml-auto truncate text-red-400">{part.error}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
