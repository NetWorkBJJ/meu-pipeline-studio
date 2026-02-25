import { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useVeo3Store } from '@/stores/useVeo3Store'
import type { WebviewElement } from '@/types/veo3'

const VEO3_URL = 'https://labs.google/fx/pt/tools/flow'

const LOGIN_SUCCESS_PATTERNS = [
  '/loginStatus',
  '/login_success',
  '/web_login_success',
  '/callback',
  '/oauth/callback'
]

const AUTH_DOMAINS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'myaccount.google.com'
]

export interface Veo3BrowserHandle {
  getWebview: () => WebviewElement | null
}

interface Veo3BrowserProps {
  onReady?: () => void
}

export const Veo3Browser = forwardRef<Veo3BrowserHandle, Veo3BrowserProps>(
  function Veo3Browser({ onReady }, ref) {
    const webviewRef = useRef<WebviewElement | null>(null)
    const { zoomFactor, setWebviewState, handleContentMessage } = useVeo3Store()

    useImperativeHandle(ref, () => ({
      getWebview: () => webviewRef.current
    }))

    const setWebviewElement = useCallback(
      (el: HTMLElement | null) => {
        if (!el) return
        const wv = el as WebviewElement
        webviewRef.current = wv

        const handleDomReady = (): void => {
          wv.setZoomFactor(zoomFactor)
          setWebviewState({
            isLoading: false,
            currentUrl: wv.getURL(),
            canGoBack: wv.canGoBack(),
            canGoForward: wv.canGoForward()
          })
          onReady?.()
        }

        const handleDidStartLoading = (): void => {
          setWebviewState({ isLoading: true })
        }

        const handleDidStopLoading = (): void => {
          setWebviewState({
            isLoading: false,
            currentUrl: wv.getURL(),
            canGoBack: wv.canGoBack(),
            canGoForward: wv.canGoForward()
          })
        }

        const handleDidNavigate = (_e: unknown): void => {
          const navUrl = wv.getURL()
          setWebviewState({
            currentUrl: navUrl,
            canGoBack: wv.canGoBack(),
            canGoForward: wv.canGoForward()
          })

          // Detect login success and redirect back to Flow
          const isLoginSuccess = LOGIN_SUCCESS_PATTERNS.some((pattern) =>
            navUrl.includes(pattern)
          )
          if (isLoginSuccess) {
            setTimeout(() => {
              wv.src = VEO3_URL
            }, 1000)
          }

          // Detect if we are on an auth domain
          const isAuthDomain = AUTH_DOMAINS.some((d) => navUrl.includes(d))
          if (!isAuthDomain && navUrl.includes('labs.google')) {
            setWebviewState({ isLoggedIn: true })
          }
        }

        const handleConsoleMessage = (e: unknown): void => {
          const event = e as { message: string }
          if (!event.message || !event.message.startsWith('{')) return

          try {
            const data = JSON.parse(event.message)
            if (data.type === 'CONTENT_TO_SIDEPANEL' || data.action) {
              handleContentMessage(data)
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
      [zoomFactor, setWebviewState, handleContentMessage, onReady]
    )

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        webviewRef.current = null
      }
    }, [])

    return (
      <webview
        ref={setWebviewElement as never}
        src={VEO3_URL}
        partition="persist:veo3"
        allowpopups={true}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }
)
