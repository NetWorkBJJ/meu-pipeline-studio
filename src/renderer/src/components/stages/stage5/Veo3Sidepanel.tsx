import { useState } from 'react'
import { useVeo3AutomationStore, DEFAULT_TAB_AUTOMATION } from '@/stores/useVeo3AutomationStore'
import { SidepanelPlanTab } from './sidepanel/SidepanelPlanTab'
import { SidepanelCharactersTab } from './sidepanel/SidepanelCharactersTab'
import { SidepanelControlsTab } from './sidepanel/SidepanelControlsTab'
import type { WebviewElement } from '@/types/veo3'

type SidepanelTab = 'plan' | 'characters' | 'controls'

const TABS: { id: SidepanelTab; label: string }[] = [
  { id: 'plan', label: 'Plano' },
  { id: 'characters', label: 'Personagens' },
  { id: 'controls', label: 'Controles' }
]

interface Veo3SidepanelProps {
  webviewRef: React.RefObject<WebviewElement | null>
  tabId: string | null
  compact?: boolean
}

export function Veo3Sidepanel({ webviewRef, tabId, compact }: Veo3SidepanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SidepanelTab>('plan')
  const tabStates = useVeo3AutomationStore((s) => s.tabStates)
  const getProgress = useVeo3AutomationStore((s) => s.getProgress)

  const tabState = (tabId ? tabStates[tabId] : null) || DEFAULT_TAB_AUTOMATION
  const progress = getProgress(tabId)

  const { isRunning, isPaused, batchPause } = tabState

  const statusLabel = isRunning
    ? batchPause
      ? `lote ${batchPause.batch}/${batchPause.totalBatches}`
      : isPaused
        ? 'paused'
        : 'running'
    : progress.completed > 0 && progress.completed === progress.total
      ? 'completed'
      : 'idle'

  const statusColor =
    statusLabel === 'running'
      ? 'bg-green-500/10 text-green-400'
      : batchPause
        ? 'bg-amber-500/10 text-amber-400'
        : statusLabel === 'paused'
          ? 'bg-yellow-500/10 text-yellow-400'
          : statusLabel === 'completed'
            ? 'bg-primary/10 text-primary'
            : 'bg-white/5 text-text-muted'

  return (
    <div className={`flex h-full flex-col ${compact ? 'w-full' : 'w-[360px]'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between border-b border-border ${compact ? 'px-2.5 py-2' : 'px-4 py-2.5'}`}>
        <h3 className={`font-semibold text-text ${compact ? 'text-xs' : 'text-sm'}`}>Flow Studio</h3>
        {statusLabel !== 'idle' && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-primary text-text'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'plan' && <SidepanelPlanTab tabId={tabId} />}
        {activeTab === 'characters' && (
          <SidepanelCharactersTab webviewRef={webviewRef} />
        )}
        {activeTab === 'controls' && (
          <SidepanelControlsTab webviewRef={webviewRef} tabId={tabId} />
        )}
      </div>

      {/* Footer */}
      {progress.total > 0 && (
        <div className={`flex items-center gap-3 border-t border-border py-2 ${compact ? 'px-2.5' : 'px-4'}`}>
          <div className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-medium text-text-muted">
            {progress.completed}/{progress.total}
          </span>
        </div>
      )}
    </div>
  )
}
