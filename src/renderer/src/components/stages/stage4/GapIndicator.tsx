import type { GapReport } from '@/lib/scenePlanner'

interface GapIndicatorProps {
  report: GapReport
}

export function GapIndicator({ report }: GapIndicatorProps): React.JSX.Element {
  const isComplete = report.coveragePercent === 100
  const gapCount = report.timelineGaps.length

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-2.5">
      <span className="whitespace-nowrap text-xs font-medium text-text-muted">Cobertura:</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-border">
        <div
          className={`h-full rounded-sm transition-all duration-300 ${
            isComplete ? 'bg-success' : 'bg-success'
          }`}
          style={{ width: `${report.coveragePercent}%` }}
        />
      </div>
      <span
        className={`text-xs font-semibold ${
          isComplete ? 'text-success' : 'text-warning'
        }`}
      >
        {report.coveragePercent}%
      </span>
      {gapCount > 0 && (
        <span className="text-[11px] text-text-muted">
          {gapCount} gaps
        </span>
      )}
    </div>
  )
}
