import { useMemo } from 'react'
import { msToDisplay } from '@/lib/time'

interface TimelineRulerProps {
  totalDurationMs: number
  pixelsPerSecond: number
  totalWidthPx: number
}

function getTickIntervalMs(pixelsPerSecond: number): number {
  if (pixelsPerSecond >= 100) return 500
  if (pixelsPerSecond >= 60) return 1000
  if (pixelsPerSecond >= 30) return 2000
  if (pixelsPerSecond >= 15) return 5000
  if (pixelsPerSecond >= 8) return 10000
  return 30000
}

export function TimelineRuler({
  totalDurationMs,
  pixelsPerSecond,
  totalWidthPx
}: TimelineRulerProps): React.JSX.Element {
  const ticks = useMemo(() => {
    const intervalMs = getTickIntervalMs(pixelsPerSecond)
    const result: { ms: number; px: number; isMain: boolean }[] = []

    for (let ms = 0; ms <= totalDurationMs; ms += intervalMs) {
      result.push({
        ms,
        px: (ms / 1000) * pixelsPerSecond,
        isMain: ms % (intervalMs * 5) === 0 || ms === 0
      })
    }

    return result
  }, [totalDurationMs, pixelsPerSecond])

  return (
    <div className="flex h-5 min-h-5 border-b border-border">
      <div className="w-[100px] min-w-[100px] border-r border-border bg-bg" />
      <div
        className="relative bg-bg"
        style={{ width: `${totalWidthPx}px`, minWidth: `${totalWidthPx}px` }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.ms}
            className="absolute top-0 flex h-full flex-col items-start"
            style={{ left: `${tick.px}px` }}
          >
            <div
              className={tick.isMain ? 'h-3 w-px bg-text-muted/50' : 'h-1.5 w-px bg-text-muted/25'}
            />
            {tick.isMain && (
              <span className="pl-0.5 text-[9px] leading-tight text-text-muted/60">
                {msToDisplay(tick.ms)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
