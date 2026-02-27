import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users } from 'lucide-react'
import { Veo3Toolbar } from './Veo3Toolbar'
import { Veo3TabBar } from './Veo3TabBar'
import { Veo3TabCell } from './Veo3TabCell'
import { Veo3AccountManager } from './Veo3AccountManager'
import { Veo3AccountSelector } from './Veo3AccountSelector'
import { Veo3Sidepanel } from './Veo3Sidepanel'
import type { Veo3BrowserHandle, WebviewState } from './Veo3Browser'
import { useVeo3AccountStore, useVeo3TabStore } from '@/stores/useVeo3Store'
import { useVeo3AutomationStore } from '@/stores/useVeo3AutomationStore'
import { useProjectStore } from '@/stores/useProjectStore'
import type { WebviewElement, Veo3ContentMessage, TabPanelState } from '@/types/veo3'

const DEFAULT_WEBVIEW_STATE: WebviewState = {
  isLoading: false,
  currentUrl: '',
  canGoBack: false,
  canGoForward: false
}

const DEFAULT_PANEL_STATE: TabPanelState = {
  sidepanelVisible: false,
  automationStatus: 'idle',
  currentPromptIndex: 0,
  totalPrompts: 0,
  promptsProcessed: 0,
  elapsedMs: 0
}

function getGridCols(count: number): string {
  if (count <= 1) return '1fr'
  if (count <= 2) return '1fr 1fr'
  return '1fr 1fr 1fr'
}

export function Stage5Veo3(): React.JSX.Element {
  const { accounts } = useVeo3AccountStore()
  const { tabs, activeTabId, setActiveTab, openTab } = useVeo3TabStore()
  const { touchAccount } = useVeo3AccountStore()

  // Auto-load automation plan from Stage 4 scenes
  const scenes = useProjectStore((s) => s.scenes)
  const automationCommands = useVeo3AutomationStore((s) => s.commands)
  const loadFromProject = useVeo3AutomationStore((s) => s.loadFromProject)

  useEffect(() => {
    if (scenes.length > 0 && automationCommands.length === 0) {
      loadFromProject()
    }
  }, [scenes.length, automationCommands.length, loadFromProject])

  const [showAccountManager, setShowAccountManager] = useState(false)
  const [showAccountSelector, setShowAccountSelector] = useState(false)
  const [splitView, setSplitView] = useState(false)

  // Per-tab refs and state
  const browserRefs = useRef<Map<string, Veo3BrowserHandle>>(new Map())
  const [tabStates, setTabStates] = useState<Map<string, WebviewState>>(new Map())
  const [tabPanelStates, setTabPanelStates] = useState<Map<string, TabPanelState>>(new Map())

  // Stable callback for browser ref updates (avoids inline function re-creation)
  const handleBrowserRef = useCallback((tabId: string, handle: Veo3BrowserHandle | null) => {
    if (handle) {
      browserRefs.current.set(tabId, handle)
    } else {
      browserRefs.current.delete(tabId)
    }
  }, [])

  // Active tab's webview ref for toolbar
  const activeWebviewRef = useRef<WebviewElement | null>(null)

  // Get active tab state
  const activeTabState = (activeTabId && tabStates.get(activeTabId)) || DEFAULT_WEBVIEW_STATE
  const activePanelState =
    (activeTabId && tabPanelStates.get(activeTabId)) || DEFAULT_PANEL_STATE

  // Update active webview ref when tab changes
  const getActiveWebview = useCallback((): WebviewElement | null => {
    if (!activeTabId) return null
    const handle = browserRefs.current.get(activeTabId)
    return handle?.getWebview() ?? null
  }, [activeTabId])

  // Keep activeWebviewRef in sync
  activeWebviewRef.current = getActiveWebview()

  const handleOpenTab = useCallback(
    (accountId: string) => {
      const tab = openTab(accountId)
      touchAccount(accountId)
      setTabStates((prev) => new Map(prev).set(tab.id, { ...DEFAULT_WEBVIEW_STATE }))
      setTabPanelStates((prev) => new Map(prev).set(tab.id, { ...DEFAULT_PANEL_STATE }))
    },
    [openTab, touchAccount]
  )

  const handleStateChange = useCallback((tabId: string, partial: Partial<WebviewState>) => {
    setTabStates((prev) => {
      const next = new Map(prev)
      const current = next.get(tabId) || { ...DEFAULT_WEBVIEW_STATE }
      next.set(tabId, { ...current, ...partial })
      return next
    })
  }, [])

  // Handle CDP requests from content-bridge: route to main process CDP, send response back
  const handleCdpRequest = useCallback(
    async (
      tabId: string,
      reqData: {
        operation: string
        requestId: string
        text?: string
        x?: number
        y?: number
        key?: string
      }
    ) => {
      const { operation, requestId, text } = reqData

      let result: { success: boolean; error?: string }

      try {
        switch (operation) {
          case 'fillPrompt':
            result = await window.api.cdpFillPrompt(text || '')
            break
          case 'clickSubmit':
            result = await window.api.cdpClickSubmit()
            break
          case 'clickAt':
            result = await window.api.cdpClickAt(reqData.x ?? 0, reqData.y ?? 0)
            break
          case 'press':
            result = await window.api.cdpPress(reqData.key ?? 'Escape')
            break
          default:
            result = { success: false, error: `Unknown CDP operation: ${operation}` }
        }
      } catch (err) {
        result = { success: false, error: String(err) }
      }

      // Send response back to content-bridge via postMessage
      const handle = browserRefs.current.get(tabId)
      const wv = handle?.getWebview()
      if (!wv) return

      const responsePayload = JSON.stringify({
        type: 'SIDEPANEL_TO_CONTENT',
        action: 'CDP_RESPONSE',
        data: { requestId, success: result.success, error: result.error }
      })

      try {
        await wv.executeJavaScript(`window.postMessage(${responsePayload}, '*')`)
      } catch (err) {
        console.error(`[Stage5Veo3] Failed to send CDP response for ${requestId}:`, err)
      }
    },
    []
  )

  const handleContentMessage = useCallback(
    (tabId: string, msg: Veo3ContentMessage) => {
      const { action, data } = msg
      if (!action) return

      // Route CDP requests to main process (async, fire-and-forget from callback)
      if (action === 'CDP_REQUEST') {
        const d = data as { operation: string; requestId: string; text?: string } | undefined
        if (d?.operation && d?.requestId) {
          handleCdpRequest(tabId, d)
        }
        return
      }

      const automationStore = useVeo3AutomationStore.getState()

      // Route to automation store for command-level updates
      switch (action) {
        case 'PROMPT_SUBMITTED': {
          const d = data as { commandId?: string } | undefined
          if (d?.commandId) automationStore.updateCommandStatus(d.commandId, 'submitted')
          break
        }
        case 'PROMPT_COMPLETED': {
          const d = data as { commandId?: string } | undefined
          if (d?.commandId) {
            automationStore.updateCommandStatus(d.commandId, 'done')
            automationStore.advanceToNext(tabId)
          }
          break
        }
        case 'PROMPT_FAILED': {
          const d = data as { commandId?: string; error?: string } | undefined
          if (d?.commandId) automationStore.updateCommandStatus(d.commandId, 'failed', d.error)
          break
        }
        case 'AUTOMATION_ERROR': {
          const d = data as { message?: string } | undefined
          automationStore.stopTab(tabId, d?.message)
          break
        }
        case 'MEDIA_LIBRARY_MAPPED': {
          const d = data as { items?: { name: string; characterId?: string }[] } | undefined
          if (d?.items) {
            for (const item of d.items) {
              if (item.characterId) {
                automationStore.updateCharacterGalleryName(item.characterId, item.name)
              }
            }
          }
          break
        }
        case 'PROMPT_SKIPPED': {
          const d = data as { commandId?: string; reason?: string } | undefined
          if (d?.commandId) {
            automationStore.updateCommandStatus(d.commandId, 'skipped', d.reason)
            automationStore.advanceToNext(tabId)
          }
          break
        }
        case 'BATCH_PAUSE': {
          const d = data as { batch?: number; totalBatches?: number; pauseSeconds?: number } | undefined
          if (d?.pauseSeconds) {
            automationStore.setBatchPause(tabId, {
              batch: d.batch ?? 0,
              totalBatches: d.totalBatches ?? 0,
              totalSeconds: d.pauseSeconds,
              pauseEndsAt: Date.now() + d.pauseSeconds * 1000
            })
          }
          break
        }
        case 'AUTOMATION_PROGRESS':
          automationStore.clearBatchPause(tabId)
          break
        case 'AUTOMATION_STARTED':
        case 'MODE_SWITCH_FAILED':
        case 'MODE_CHANGED':
        case 'PAGE_READY':
        case 'DEBUG_ERROR':
        case 'BATCH_PAUSE_UPDATE':
          break
      }

      // Route to panel states for UI status display
      setTabPanelStates((prev) => {
        const next = new Map(prev)
        const current = next.get(tabId) || { ...DEFAULT_PANEL_STATE }
        const updated = { ...current }

        switch (action) {
          case 'AUTOMATION_STARTED':
            updated.automationStatus = 'running'
            break
          case 'AUTOMATION_STOPPED':
            updated.automationStatus = 'stopped'
            break
          case 'AUTOMATION_PAUSED':
            updated.automationStatus = 'paused'
            break
          case 'AUTOMATION_RESUMED':
            updated.automationStatus = 'running'
            break
          case 'AUTOMATION_COMPLETE':
            updated.automationStatus = 'completed'
            break
          case 'AUTOMATION_ERROR':
            updated.automationStatus = 'stopped'
            break
          case 'AUTOMATION_PROGRESS': {
            const progress = data as
              | { current?: number; total?: number; elapsed?: number }
              | undefined
            if (progress) {
              updated.currentPromptIndex = progress.current ?? 0
              updated.totalPrompts = progress.total ?? 0
              updated.promptsProcessed = progress.current ?? 0
              updated.elapsedMs = progress.elapsed ?? 0
            }
            break
          }
          case 'BATCH_PAUSE':
            updated.automationStatus = 'paused'
            break
          case 'BATCH_PAUSE_UPDATE':
            break
        }

        next.set(tabId, updated)
        return next
      })
    },
    [handleCdpRequest]
  )

  const handleToggleSidepanel = useCallback(() => {
    if (!activeTabId) return
    setTabPanelStates((prev) => {
      const next = new Map(prev)
      const current = next.get(activeTabId) || { ...DEFAULT_PANEL_STATE }
      next.set(activeTabId, { ...current, sidepanelVisible: !current.sidepanelVisible })
      return next
    })
  }, [activeTabId])

  const handleToggleSidepanelForTab = useCallback((tabId: string) => {
    setTabPanelStates((prev) => {
      const next = new Map(prev)
      const current = next.get(tabId) || { ...DEFAULT_PANEL_STATE }
      next.set(tabId, { ...current, sidepanelVisible: !current.sidepanelVisible })
      return next
    })
  }, [])

  const handleBrowserReady = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) {
        activeWebviewRef.current = browserRefs.current.get(tabId)?.getWebview() ?? null
      }
    },
    [activeTabId]
  )

  const handleOpenSelector = useCallback(() => {
    if (accounts.length === 0) {
      setShowAccountManager(true)
    } else {
      setShowAccountSelector(true)
    }
  }, [accounts.length])

  // Empty state: no accounts
  if (accounts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-white/5 p-4">
          <Users className="h-8 w-8 text-text-muted" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-text">Nenhuma conta cadastrada</h3>
          <p className="mt-1 text-xs text-text-muted">
            Adicione uma conta Google para comecar a usar o VEO3 Flow.
          </p>
        </div>
        <button
          onClick={() => setShowAccountManager(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar Conta
        </button>

        <Veo3AccountManager
          open={showAccountManager}
          onClose={() => setShowAccountManager(false)}
        />
      </div>
    )
  }

  // Has accounts but no tabs open
  if (tabs.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
          <button
            onClick={() => setShowAccountManager(true)}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
            title="Gerenciar contas"
          >
            <Users className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs text-text-muted">VEO3 Flow</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-xs text-text-muted">
            Selecione uma conta para abrir o VEO3 Flow
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => handleOpenTab(account.id)}
                className="flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2.5 transition-colors hover:border-primary/40 hover:bg-white/5"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: account.color }}
                />
                <span className="text-xs font-medium text-text">{account.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAccountManager(true)}
            className="mt-2 flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-primary"
          >
            <Plus className="h-3 w-3" />
            Gerenciar contas
          </button>
        </div>

        <Veo3AccountManager
          open={showAccountManager}
          onClose={() => setShowAccountManager(false)}
        />
      </div>
    )
  }

  // Normal state: tabs open
  return (
    <div className="flex h-full flex-col">
      <Veo3Toolbar
        webviewRef={activeWebviewRef}
        webviewState={activeTabState}
        sidepanelVisible={activePanelState.sidepanelVisible}
        splitView={splitView}
        onToggleSidepanel={handleToggleSidepanel}
        onToggleSplitView={() => setSplitView((v) => !v)}
        onOpenAccountManager={() => setShowAccountManager(true)}
      />

      {!splitView && <Veo3TabBar onOpenAccountSelector={handleOpenSelector} />}

      <div className="flex flex-1 overflow-hidden">
        {/* Unified webview container - CSS-driven layout, no unmount on mode switch */}
        <div
          className={splitView ? 'flex-1 grid gap-px bg-border' : 'relative flex-1 bg-bg'}
          style={splitView ? { gridTemplateColumns: getGridCols(tabs.length), gridAutoRows: '1fr' } : undefined}
        >
          {tabs.map((tab) => {
            const account = accounts.find((a) => a.id === tab.accountId)
            if (!account) return null

            return (
              <Veo3TabCell
                key={tab.id}
                tabId={tab.id}
                account={account}
                isActive={tab.id === activeTabId}
                splitView={splitView}
                panelState={tabPanelStates.get(tab.id) || DEFAULT_PANEL_STATE}
                panelWidth={tabs.length >= 3 ? 220 : 260}
                onBrowserRef={handleBrowserRef}
                onSelect={() => setActiveTab(tab.id)}
                onBrowserReady={() => handleBrowserReady(tab.id)}
                onStateChange={(partial) => handleStateChange(tab.id, partial)}
                onContentMessage={(msg) => handleContentMessage(tab.id, msg)}
                onTogglePanel={() => handleToggleSidepanelForTab(tab.id)}
              />
            )
          })}
        </div>

        {/* Sidepanel - Flow Studio (only in tab mode) */}
        {!splitView && (
          <AnimatePresence>
            {activePanelState.sidepanelVisible && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="shrink-0 overflow-hidden border-l border-border bg-surface"
              >
                <Veo3Sidepanel webviewRef={activeWebviewRef} tabId={activeTabId} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Modals */}
      <Veo3AccountManager
        open={showAccountManager}
        onClose={() => setShowAccountManager(false)}
      />
      <Veo3AccountSelector
        open={showAccountSelector}
        onClose={() => setShowAccountSelector(false)}
        onSelect={handleOpenTab}
      />
    </div>
  )
}
