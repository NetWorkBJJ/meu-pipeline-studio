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
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-yellow-500/30 bg-yellow-500/5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
          )}
          <span className="text-xs font-medium text-text">
            {report.coveredScenes}/{report.totalScenes} cenas com midia
          </span>
        </div>
        <span
          className={`text-sm font-bold ${
            isComplete ? 'text-green-400' : 'text-yellow-400'
          }`}
        >
          {report.coveragePercent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-green-500' : 'bg-yellow-500'
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
