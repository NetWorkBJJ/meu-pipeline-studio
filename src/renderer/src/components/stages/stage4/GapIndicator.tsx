import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { GapReport } from '@/lib/scenePlanner'

interface GapIndicatorProps {
  report: GapReport
}

export function GapIndicator({ report }: GapIndicatorProps): React.JSX.Element {
  const isComplete = report.coveragePercent === 100

  return (
    <div
      className={`rounded-lg border p-3 ${
        isComplete
          ? 'border-success/30 bg-success/5'
          : 'border-warning/30 bg-warning/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-warning" />
          )}
          <span className="text-xs font-medium text-text">
            {report.coveredScenes}/{report.totalScenes} cenas com midia
          </span>
        </div>
        <span
          className={`text-sm font-bold ${
            isComplete ? 'text-success' : 'text-warning'
          }`}
        >
          {report.coveragePercent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-success' : 'bg-warning'
          }`}
          style={{ width: `${report.coveragePercent}%` }}
        />
      </div>

      {/* Gap details */}
      {report.timelineGaps.length > 0 && (
        <div className="mt-2">
          <span className="text-[10px] text-text-muted">
            {report.timelineGaps.length} gap(s) - Cenas faltando:{' '}
            {report.missingScenes.map((s) => s.index).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}
