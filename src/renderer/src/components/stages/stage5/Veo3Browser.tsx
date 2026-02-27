import { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useVeo3Store } from '@/stores/useVeo3Store'
import type { WebviewElement, Veo3ContentMessage } from '@/types/veo3'

const VEO3_URL = 'https://labs.google/fx/pt/tools/flow'

const AUTH_DOMAINS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'myaccount.google.com'
]

const INJECTOR_SCRIPTS = [
  'utils/debug-logger.js',
  'constants/selectors.js',
  'utils/timing.js',
  'utils/click-feedback.js',
  'utils/click-logger.js',
  'automation/image-automator.js',
  'automation/gallery-mapper.js',
  'automation/elements-mode-handler.js',
  'automation/image-creation-handler.js',
  'content-bridge.js'
]

export interface Veo3BrowserHandle {
  getWebview: () => WebviewElement | null
}

export interface WebviewState {
  isLoading: boolean
  currentUrl: string
  canGoBack: boolean
  canGoForward: boolean
}

interface Veo3BrowserProps {
  partition: string
  visible: boolean
  onReady?: () => void
  onStateChange?: (state: Partial<WebviewState>) => void
  onLoginDetected?: () => void
  onContentMessage?: (msg: Veo3ContentMessage) => void
}

export const Veo3Browser = forwardRef<Veo3BrowserHandle, Veo3BrowserProps>(
  function Veo3Browser(
    { partition, visible, onReady, onStateChange, onLoginDetected, onContentMessage },
    ref
  ) {
    const webviewRef = useRef<WebviewElement | null>(null)
    const wasOnAuthDomain = useRef(false)
    const listenersAttached = useRef(false)
    const domReady = useRef(false)
    const lastInjectionTime = useRef(0)
    const { zoomFactor } = useVeo3Store()

    // Latest-ref pattern: store callbacks in refs so event handlers always read latest values
    const onReadyRef = useRef(onReady)
    const onStateChangeRef = useRef(onStateChange)
    const onLoginDetectedRef = useRef(onLoginDetected)
    const onContentMessageRef = useRef(onContentMessage)
    const zoomFactorRef = useRef(zoomFactor)

    // Sync refs on every render (no useEffect needed, direct assignment is safe)
    onReadyRef.current = onReady
    onStateChangeRef.current = onStateChange
    onLoginDetectedRef.current = onLoginDetected
    onContentMessageRef.current = onContentMessage
    zoomFactorRef.current = zoomFactor

    useImperativeHandle(ref, () => ({
      getWebview: () => webviewRef.current
    }))

    // Stable ref callback - registers event listeners exactly ONCE per mount
    const setWebviewElement = useCallback((el: HTMLElement | null) => {
      if (!el) {
        webviewRef.current = null
        return
      }

      const wv = el as WebviewElement
      webviewRef.current = wv

      // Guard: only attach listeners once
      if (listenersAttached.current) return
      listenersAttached.current = true

      const handleDomReady = async (): Promise<void> => {
        domReady.current = true
        wv.setZoomFactor(zoomFactorRef.current)
        onStateChangeRef.current?.({
          isLoading: false,
          currentUrl: wv.getURL(),
          canGoBack: wv.canGoBack(),
          canGoForward: wv.canGoForward()
        })

        // Inject automation scripts (only on Flow pages)
        // Debounce: skip if dom-ready fired within 2s (prevents double injection on SPA navigation)
        const currentUrl = wv.getURL()
        const now = Date.now()
        if (currentUrl.includes('labs.google') && currentUrl.includes('flow') &&
            now - lastInjectionTime.current >= 2000) {
          lastInjectionTime.current = now
          for (const script of INJECTOR_SCRIPTS) {
            try {
              const code = await window.api.veo3ReadScript(script)
              if (code) {
                await wv.executeJavaScript(code)
                await wv.executeJavaScript(
                  `window.veo3Debug?.info('INJECT', 'Loaded: ${script}')`
                )
              }
            } catch (err) {
              console.error(`[Veo3Browser] Failed to inject ${script}:`, err)
            }
          }
        }

        onReadyRef.current?.()
      }

      const handleDidStartLoading = (): void => {
        onStateChangeRef.current?.({ isLoading: true })
      }

      const handleDidStopLoading = (): void => {
        onStateChangeRef.current?.({
          isLoading: false,
          currentUrl: wv.getURL(),
          canGoBack: wv.canGoBack(),
          canGoForward: wv.canGoForward()
        })
      }

      const handleDidNavigate = (): void => {
        const navUrl = wv.getURL()
        onStateChangeRef.current?.({
          currentUrl: navUrl,
          canGoBack: wv.canGoBack(),
          canGoForward: wv.canGoForward()
        })

        const isAuthDomain = AUTH_DOMAINS.some((d) => navUrl.includes(d))
        if (isAuthDomain) {
          wasOnAuthDomain.current = true
        }

        if (!isAuthDomain && navUrl.includes('labs.google') && wasOnAuthDomain.current) {
          onLoginDetectedRef.current?.()
          wasOnAuthDomain.current = false
        }
      }

      const handleConsoleMessage = (e: unknown): void => {
        const event = e as { message: string }
        if (!event.message || !event.message.startsWith('{')) return

        try {
          const data = JSON.parse(event.message)
          if (data.type === 'CONTENT_TO_SIDEPANEL' || data.action) {
            onContentMessageRef.current?.(data as Veo3ContentMessage)
          }
        } catch {
          // Not JSON, ignore
        }
      }

      wv.addEventListener('dom-ready', handleDomReady)
      wv.addEventListener('did-start-loading', handleDidStartLoading)
      wv.addEventListener('did-stop-loading', handleDidStopLoading)
      wv.addEventListener('did-navigate', handleDidNavigate)
      wv.addEventListener('did-navigate-in-page', handleDidNavigate)
      wv.addEventListener('console-message', handleConsoleMessage)
    }, [])

    // Sync zoom factor changes without re-registering listeners
    // Guard: only call setZoomFactor after dom-ready has fired
    useEffect(() => {
      if (domReady.current) {
        webviewRef.current?.setZoomFactor(zoomFactor)
      }
    }, [zoomFactor])

    useEffect(() => {
      return () => {
        webviewRef.current = null
        domReady.current = false
      }
    }, [])

    return (
      <webview
        ref={setWebviewElement as never}
        src={VEO3_URL}
        partition={partition}
        allowpopups={true}
        style={{
          width: '100%',
          height: '100%',
          display: visible ? 'flex' : 'none'
        }}
      />
    )
  }
)
