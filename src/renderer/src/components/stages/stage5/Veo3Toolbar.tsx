import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Home,
  PanelRightClose,
  PanelRightOpen,
  ZoomIn,
  ZoomOut,
  Bug,
  ClipboardCopy,
  Users,
  LayoutGrid,
  Square
} from 'lucide-react'
import { useVeo3Store } from '@/stores/useVeo3Store'
import type { WebviewElement } from '@/types/veo3'
import type { WebviewState } from './Veo3Browser'

const VEO3_HOME_URL = 'https://labs.google/fx/pt/tools/flow'

const ZOOM_LEVELS = [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0]

interface Veo3ToolbarProps {
  webviewRef: { current: WebviewElement | null }
  webviewState: WebviewState
  sidepanelVisible: boolean
  splitView: boolean
  onToggleSidepanel: () => void
  onToggleSplitView: () => void
  onOpenAccountManager: () => void
}

export function Veo3Toolbar({
  webviewRef,
  webviewState,
  sidepanelVisible,
  splitView,
  onToggleSidepanel,
  onToggleSplitView,
  onOpenAccountManager
}: Veo3ToolbarProps): React.JSX.Element {
  const { zoomFactor, setZoomFactor } = useVeo3Store()

  const { isLoading, currentUrl, canGoBack, canGoForward } = webviewState

  const handleBack = (): void => {
    webviewRef.current?.goBack()
  }

  const handleForward = (): void => {
    webviewRef.current?.goForward()
  }

  const handleRefresh = (): void => {
    if (isLoading) {
      webviewRef.current?.stop()
    } else {
      webviewRef.current?.reload()
    }
  }

  const handleHome = (): void => {
    if (webviewRef.current) {
      webviewRef.current.src = VEO3_HOME_URL
    }
  }

  const handleZoomIn = (): void => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= zoomFactor)
    const nextIndex = Math.min(currentIndex + 1, ZOOM_LEVELS.length - 1)
    const newZoom = ZOOM_LEVELS[nextIndex]
    webviewRef.current?.setZoomFactor(newZoom)
    setZoomFactor(newZoom)
  }

  const handleZoomOut = (): void => {
    const currentIndex = ZOOM_LEVELS.findIndex((z) => z >= zoomFactor)
    const prevIndex = Math.max(currentIndex - 1, 0)
    const newZoom = ZOOM_LEVELS[prevIndex]
    webviewRef.current?.setZoomFactor(newZoom)
    setZoomFactor(newZoom)
  }

  const handleDevTools = (): void => {
    webviewRef.current?.openDevTools()
  }

  const handleCopyDebugLogs = async (): Promise<void> => {
    const wv = webviewRef.current
    if (!wv) return
    try {
      const logs = (await wv.executeJavaScript('window.veo3Debug?.dump() || "[]"')) as string
      await navigator.clipboard.writeText(logs)
    } catch {
      // Silently fail if clipboard not available
    }
  }

  const displayUrl = currentUrl
    ? currentUrl.replace('https://', '').replace('http://', '')
    : ''

  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-3">
      {/* Account manager */}
      <button
        onClick={onOpenAccountManager}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title="Gerenciar contas"
      >
        <Users className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Navigation */}
      <button
        onClick={handleBack}
        disabled={!canGoBack}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text disabled:opacity-30"
        title="Voltar"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleForward}
        disabled={!canGoForward}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text disabled:opacity-30"
        title="Avancar"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleRefresh}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title={isLoading ? 'Parar' : 'Recarregar'}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={handleHome}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title="Pagina inicial do Flow"
      >
        <Home className="h-3.5 w-3.5" />
      </button>

      {/* URL bar */}
      <div className="mx-2 flex flex-1 items-center rounded-md border border-border bg-bg px-3 py-1">
        <span className="truncate text-xs text-text-muted">{displayUrl}</span>
      </div>

      {/* Zoom */}
      <button
        onClick={handleZoomOut}
        disabled={zoomFactor <= ZOOM_LEVELS[0]}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text disabled:opacity-30"
        title="Diminuir zoom"
      >
        <ZoomOut className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[36px] text-center text-[10px] text-text-muted">
        {Math.round(zoomFactor * 100)}%
      </span>
      <button
        onClick={handleZoomIn}
        disabled={zoomFactor >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text disabled:opacity-30"
        title="Aumentar zoom"
      >
        <ZoomIn className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-border" />

      {/* DevTools + Debug logs */}
      <button
        onClick={handleCopyDebugLogs}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title="Copiar logs de debug"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleDevTools}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title="DevTools"
      >
        <Bug className="h-3.5 w-3.5" />
      </button>

      {/* Split view toggle */}
      <button
        onClick={onToggleSplitView}
        className={`rounded-md p-1.5 transition-colors hover:bg-white/5 hover:text-text ${
          splitView ? 'text-primary' : 'text-text-muted'
        }`}
        title={splitView ? 'Visualizacao em abas' : 'Visualizacao em grade'}
      >
        {splitView ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <LayoutGrid className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Toggle sidepanel */}
      <button
        onClick={onToggleSidepanel}
        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title={sidepanelVisible ? 'Esconder painel' : 'Mostrar painel'}
      >
        {sidepanelVisible ? (
          <PanelRightClose className="h-3.5 w-3.5" />
        ) : (
          <PanelRightOpen className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
