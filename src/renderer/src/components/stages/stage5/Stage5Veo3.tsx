import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Users } from 'lucide-react'
import { Veo3Toolbar } from './Veo3Toolbar'
import { Veo3Browser } from './Veo3Browser'
import { Veo3TabBar } from './Veo3TabBar'
import { Veo3AccountManager } from './Veo3AccountManager'
import { Veo3AccountSelector } from './Veo3AccountSelector'
import type { Veo3BrowserHandle, WebviewState } from './Veo3Browser'
import { useVeo3AccountStore, useVeo3TabStore } from '@/stores/useVeo3Store'
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

export function Stage5Veo3(): React.JSX.Element {
  const { accounts } = useVeo3AccountStore()
  const { tabs, activeTabId, openTab } = useVeo3TabStore()
  const { touchAccount } = useVeo3AccountStore()

  const [showAccountManager, setShowAccountManager] = useState(false)
  const [showAccountSelector, setShowAccountSelector] = useState(false)

  // Per-tab refs and state
  const browserRefs = useRef<Map<string, Veo3BrowserHandle>>(new Map())
  const [tabStates, setTabStates] = useState<Map<string, WebviewState>>(new Map())
  const [tabPanelStates, setTabPanelStates] = useState<Map<string, TabPanelState>>(new Map())

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
      // Initialize state for new tab
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

  const handleContentMessage = useCallback(
    (tabId: string, msg: Veo3ContentMessage) => {
      const { action, data } = msg
      if (!action) return

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
        }

        next.set(tabId, updated)
        return next
      })
    },
    []
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

  const handleBrowserReady = useCallback(
    (tabId: string) => {
      // Update active webview ref
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
        {/* Minimal toolbar */}
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
        onToggleSidepanel={handleToggleSidepanel}
        onOpenAccountManager={() => setShowAccountManager(true)}
      />

      <Veo3TabBar onOpenAccountSelector={handleOpenSelector} />

      <div className="flex flex-1 overflow-hidden">
        {/* Webview area - all tabs rendered, only active visible */}
        <div className="relative flex-1 bg-bg">
          {tabs.map((tab) => {
            const account = accounts.find((a) => a.id === tab.accountId)
            if (!account) return null

            return (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
              >
                <Veo3Browser
                  ref={(handle) => {
                    if (handle) {
                      browserRefs.current.set(tab.id, handle)
                    } else {
                      browserRefs.current.delete(tab.id)
                    }
                  }}
                  partition={account.partition}
                  visible={tab.id === activeTabId}
                  onReady={() => handleBrowserReady(tab.id)}
                  onStateChange={(partial) => handleStateChange(tab.id, partial)}
                  onContentMessage={(msg) => handleContentMessage(tab.id, msg)}
                  onLoginDetected={() => {
                    // Could track per-account login status if needed
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Sidepanel - per-tab, shows active tab's panel */}
        <AnimatePresence>
          {activePanelState.sidepanelVisible && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="shrink-0 overflow-hidden border-l border-border bg-surface"
            >
              <div className="flex h-full w-[360px] flex-col">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-text">VEO3 Studio</h3>
                  {activePanelState.automationStatus !== 'idle' && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        activePanelState.automationStatus === 'running'
                          ? 'bg-green-500/10 text-green-400'
                          : activePanelState.automationStatus === 'paused'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : activePanelState.automationStatus === 'completed'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {activePanelState.automationStatus}
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {activePanelState.automationStatus !== 'idle' ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border bg-bg p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">Progresso</span>
                          <span className="font-medium text-text">
                            {activePanelState.promptsProcessed}/{activePanelState.totalPrompts}
                          </span>
                        </div>
                        {activePanelState.totalPrompts > 0 && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${(activePanelState.promptsProcessed / activePanelState.totalPrompts) * 100}%`
                              }}
                            />
                          </div>
                        )}
                      </div>
                      {activePanelState.elapsedMs > 0 && (
                        <p className="text-[11px] text-text-muted">
                          Tempo: {Math.round(activePanelState.elapsedMs / 1000)}s
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      Painel de controle para automacao do VEO3. Faca login no Google para
                      comecar.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
