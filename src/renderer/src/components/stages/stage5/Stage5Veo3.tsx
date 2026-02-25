import { useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Veo3Toolbar } from './Veo3Toolbar'
import { Veo3Browser } from './Veo3Browser'
import type { Veo3BrowserHandle } from './Veo3Browser'
import { useVeo3Store } from '@/stores/useVeo3Store'
import type { WebviewElement } from '@/types/veo3'

export function Stage5Veo3(): React.JSX.Element {
  const browserRef = useRef<Veo3BrowserHandle>(null)
  const { sidepanelVisible } = useVeo3Store()

  // Create a stable ref object for the webview that toolbar can use
  const webviewRef = useRef<WebviewElement | null>(null)

  const handleBrowserReady = useCallback(() => {
    webviewRef.current = browserRef.current?.getWebview() ?? null
  }, [])

  return (
    <div className="flex h-full flex-col">
      <Veo3Toolbar webviewRef={webviewRef} />

      <div className="flex flex-1 overflow-hidden">
        {/* Webview area */}
        <div className="flex-1 bg-bg">
          <Veo3Browser ref={browserRef} onReady={handleBrowserReady} />
        </div>

        {/* Sidepanel */}
        <AnimatePresence>
          {sidepanelVisible && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="shrink-0 overflow-hidden border-l border-border bg-surface"
            >
              <div className="flex h-full w-[360px] flex-col">
                <div className="flex items-center border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-text">VEO3 Studio</h3>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <p className="text-xs text-text-muted">
                    Painel de controle para automacao do VEO3. Faca login no Google para comecar.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
