import { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useVeo3Store } from '@/stores/useVeo3Store'
import type { WebviewElement, Veo3ContentMessage } from '@/types/veo3'

const VEO3_URL = 'https://labs.google/fx/pt/tools/flow'

const AUTH_DOMAINS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'myaccount.google.com'
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
    const { zoomFactor } = useVeo3Store()

    useImperativeHandle(ref, () => ({
      getWebview: () => webviewRef.current
    }))

    const setWebviewElement = useCallback(
      (el: HTMLElement | null) => {
        if (!el) return
        const wv = el as WebviewElement
        webviewRef.current = wv

        const handleDomReady = async (): Promise<void> => {
          wv.setZoomFactor(zoomFactor)
          onStateChange?.({
            isLoading: false,
            currentUrl: wv.getURL(),
            canGoBack: wv.canGoBack(),
            canGoForward: wv.canGoForward()
          })

          // Inject automation scripts (only on Flow pages)
          const currentUrl = wv.getURL()
          if (currentUrl.includes('labs.google') && currentUrl.includes('flow')) {
            const INJECTOR_SCRIPTS = [
              'constants/selectors.js',
              'utils/timing.js',
              'utils/click-feedback.js',
              'automation/image-automator.js',
              'automation/gallery-mapper.js',
              'automation/image-ref-manager.js',
              'automation/elements-mode-handler.js',
              'automation/image-creation-handler.js',
              'content-bridge.js'
            ]

            for (const script of INJECTOR_SCRIPTS) {
              try {
                const code = await window.api.veo3ReadScript(script)
                if (code) await wv.executeJavaScript(code)
              } catch (err) {
                console.error(`[Veo3Browser] Failed to inject ${script}:`, err)
              }
            }
          }

          onReady?.()
        }

        const handleDidStartLoading = (): void => {
          onStateChange?.({ isLoading: true })
        }

        const handleDidStopLoading = (): void => {
          onStateChange?.({
            isLoading: false,
            currentUrl: wv.getURL(),
            canGoBack: wv.canGoBack(),
            canGoForward: wv.canGoForward()
          })
        }

        const handleDidNavigate = (_e: unknown): void => {
          const navUrl = wv.getURL()
          onStateChange?.({
            currentUrl: navUrl,
            canGoBack: wv.canGoBack(),
            canGoForward: wv.canGoForward()
          })

          const isAuthDomain = AUTH_DOMAINS.some((d) => navUrl.includes(d))
          if (isAuthDomain) {
            wasOnAuthDomain.current = true
          }

          if (!isAuthDomain && navUrl.includes('labs.google') && wasOnAuthDomain.current) {
            onLoginDetected?.()
            wasOnAuthDomain.current = false
          }
        }

        const handleConsoleMessage = (e: unknown): void => {
          const event = e as { message: string }
          if (!event.message || !event.message.startsWith('{')) return

          try {
            const data = JSON.parse(event.message)
            if (data.type === 'CONTENT_TO_SIDEPANEL' || data.action) {
              onContentMessage?.(data as Veo3ContentMessage)
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
      },
      [zoomFactor, onReady, onStateChange, onLoginDetected, onContentMessage]
    )

    useEffect(() => {
      return () => {
        webviewRef.current = null
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
