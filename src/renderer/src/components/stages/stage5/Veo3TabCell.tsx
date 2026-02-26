import { useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Veo3Browser } from './Veo3Browser'
import { Veo3Sidepanel } from './Veo3Sidepanel'
import type { Veo3BrowserHandle, WebviewState } from './Veo3Browser'
import type {
  Veo3Account,
  Veo3ContentMessage,
  TabPanelState,
  WebviewElement
} from '@/types/veo3'

interface Veo3TabCellProps {
  tabId: string
  account: Veo3Account
  isActive: boolean
  splitView: boolean
  panelState: TabPanelState
  panelWidth: number
  onBrowserRef: (tabId: string, handle: Veo3BrowserHandle | null) => void
  onSelect: () => void
  onBrowserReady: () => void
  onStateChange: (partial: Partial<WebviewState>) => void
  onContentMessage: (msg: Veo3ContentMessage) => void
  onTogglePanel: () => void
}

export function Veo3TabCell({
  tabId,
  account,
  isActive,
  splitView,
  panelState,
  panelWidth,
  onBrowserRef,
  onSelect,
  onBrowserReady,
  onStateChange,
  onContentMessage,
  onTogglePanel
}: Veo3TabCellProps): React.JSX.Element {
  const cellWebviewRef = useRef<WebviewElement | null>(null)
  const handleRef = useRef<Veo3BrowserHandle | null>(null)

  // Stable ref callback - tabId is stable per cell, onBrowserRef is stable from parent
  const setBrowserRef = useCallback(
    (handle: Veo3BrowserHandle | null) => {
      handleRef.current = handle
      cellWebviewRef.current = handle?.getWebview() ?? null
      onBrowserRef(tabId, handle)
    },
    [tabId, onBrowserRef]
  )

  const handleReady = useCallback(() => {
    cellWebviewRef.current = handleRef.current?.getWebview() ?? null
    onBrowserReady()
  }, [onBrowserReady])

  // In split mode: always visible (grid handles layout)
  // In tab mode: only visible if active
  const isVisible = splitView || isActive

  return (
    <div
      className={`flex flex-col bg-bg ${splitView ? '' : 'absolute inset-0'} ${splitView && isActive ? 'ring-1 ring-inset ring-primary' : ''}`}
      style={{ display: isVisible ? 'flex' : 'none' }}
      onClick={splitView ? onSelect : undefined}
    >
      {/* Cell header - only in split view */}
      {splitView && (
        <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2">
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: account.color }}
          />
          <span className="flex-1 truncate text-[10px] text-text-muted">{account.name}</span>
          {panelState.automationStatus === 'running' && (
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
          {panelState.automationStatus === 'paused' && (
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          )}
          {panelState.automationStatus === 'completed' && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTogglePanel()
            }}
            className="rounded p-0.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
            title={panelState.sidepanelVisible ? 'Esconder painel' : 'Mostrar painel'}
          >
            {panelState.sidepanelVisible ? (
              <PanelRightClose className="h-3 w-3" />
            ) : (
              <PanelRightOpen className="h-3 w-3" />
            )}
          </button>
        </div>
      )}

      {/* Content: webview + optional inline panel (grid mode only) */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <Veo3Browser
            ref={setBrowserRef}
            partition={account.partition}
            visible={isVisible}
            onReady={handleReady}
            onStateChange={onStateChange}
            onContentMessage={onContentMessage}
            onLoginDetected={() => {}}
          />
        </div>
        {splitView && (
          <AnimatePresence>
            {panelState.sidepanelVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: panelWidth, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="shrink-0 overflow-hidden border-l border-border bg-surface"
              >
                <Veo3Sidepanel webviewRef={cellWebviewRef} tabId={tabId} compact />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
