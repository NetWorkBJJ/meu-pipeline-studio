import { useState } from 'react'
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
  Square,
  Loader2,
  XCircle,
  Download
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
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState('')

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

  const handleStopDownload = async (): Promise<void> => {
    const wv = webviewRef.current
    if (!wv) return
    try {
      await wv.executeJavaScript('window.__downloadCancelled = true')
    } catch {
      // ignore
    }
    setIsDownloading(false)
    setDownloadStatus('')
  }

  const handleDownloadMedia = async (): Promise<void> => {
    const wv = webviewRef.current
    if (!wv) return
    setIsDownloading(true)
    setDownloadStatus('Mapeando midias...')
    try {
      await wv.executeJavaScript('window.__downloadCancelled = false')

      // Passo 1: mapeia videos E imagens em um unico scroll
      const resultJson = (await wv.executeJavaScript(`(async function() {
        var container = document.querySelector('[data-testid="virtuoso-scroller"]');
        var videos = new Map();
        var imagens = new Map();
        var lastScroll = -1;
        var sameCount = 0;

        console.log("Mapeando videos e imagens...");

        while (sameCount < 8) {
          if (window.__downloadCancelled) return JSON.stringify({ videos: 0, imagens: 0 });

          // Media-first approach: start from video/img elements and walk UP the DOM
          // to find the nearest ancestor with "(TAKE N)" text.
          // This avoids the parent-div problem where innerText aggregates all children.

          // 1. Map videos
          var allVideoEls = document.querySelectorAll("video");
          for (var v = 0; v < allVideoEls.length; v++) {
            var videoEl = allVideoEls[v];
            if (!videoEl.src) continue;

            var parent = videoEl.parentElement;
            while (parent && parent !== document.body) {
              var match = parent.innerText.match(/\\(TAKE\\s+(\\d+)\\)/);
              if (match) {
                var take = parseInt(match[1]);
                if (!videos.has(take)) {
                  videos.set(take, videoEl.src);
                }
                break;
              }
              parent = parent.parentElement;
            }
          }

          // 2. Map images (largest per card, skip icons/thumbnails)
          var allImgEls = document.querySelectorAll("img");
          for (var im = 0; im < allImgEls.length; im++) {
            var imgEl = allImgEls[im];
            if (!imgEl.src || imgEl.src.startsWith("data:")) continue;
            var w = imgEl.naturalWidth || imgEl.width || 0;
            var h = imgEl.naturalHeight || imgEl.height || 0;
            if (w * h < 2500) continue;

            var parent = imgEl.parentElement;
            while (parent && parent !== document.body) {
              var match = parent.innerText.match(/\\(TAKE\\s+(\\d+)\\)/);
              if (match) {
                var take = parseInt(match[1]);
                if (!videos.has(take) && !imagens.has(take)) {
                  var src = imgEl.src;
                  if (src.includes("googleusercontent.com")) {
                    src = src.replace(/=w\\d+.*$/, "=s0").replace(/=s\\d+.*$/, "=s0");
                  }
                  imagens.set(take, src);
                }
                break;
              }
              parent = parent.parentElement;
            }
          }

          container.scrollTop += 2000;
          await new Promise(function(r) { setTimeout(r, 800); });

          if (container.scrollTop === lastScroll) {
            sameCount++;
          } else {
            sameCount = 0;
            lastScroll = container.scrollTop;
          }
        }

        console.log("=== MAPEAMENTO COMPLETO ===");
        console.log("TOTAL VIDEOS:", videos.size, "| TOTAL IMAGENS:", imagens.size);

        var debugVideos = [];
        for (var dv of videos.entries()) {
          debugVideos.push({ take: dv[0], url: dv[1].substring(0, 80) + "..." });
        }
        var debugImagens = [];
        for (var di of imagens.entries()) {
          debugImagens.push({ take: di[0], url: di[1].substring(0, 80) + "..." });
        }
        if (debugVideos.length > 0) console.table(debugVideos);
        if (debugImagens.length > 0) console.table(debugImagens);

        window.videosMapeados = videos;
        window.imagensMapeadas = imagens;
        return JSON.stringify({ videos: videos.size, imagens: imagens.size });
      })()`)) as string

      const counts = JSON.parse(resultJson)
      var total = counts.videos + counts.imagens

      if (total === 0) {
        setDownloadStatus('Nenhuma midia encontrada')
        setTimeout(() => {
          setIsDownloading(false)
          setDownloadStatus('')
        }, 2000)
        return
      }

      // Passo 2: baixa videos
      if (counts.videos > 0) {
        setDownloadStatus(`Baixando ${counts.videos} videos...`)

        await wv.executeJavaScript(`(async function() {
          if (!window.videosMapeados) return;

          console.log("Iniciando download dos videos...");

          var videoEntries = [...window.videosMapeados.entries()];
          videoEntries.sort(function(a, b) { return a[0] - b[0]; });

          for (var vi = 0; vi < videoEntries.length; vi++) {
            if (window.__downloadCancelled) {
              console.log("Download cancelado pelo usuario.");
              return;
            }

            var take = videoEntries[vi][0];
            var videoSrc = videoEntries[vi][1];

            var formatted = take.toString().padStart(4, '0');

            var response = await fetch(videoSrc);
            var realUrl = response.url;

            var fileResponse = await fetch(realUrl);
            var blob = await fileResponse.blob();

            var blobUrl = URL.createObjectURL(blob);

            var a = document.createElement("a");
            a.href = blobUrl;
            a.download = "TAKE " + formatted + ".mp4";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(blobUrl);

            console.log("Baixado video TAKE", formatted);

            await new Promise(function(r) { setTimeout(r, 1500); });
          }

          console.log("DOWNLOAD DE VIDEOS COMPLETO");
        })()`)
      }

      // Passo 3: baixa imagens
      if (counts.imagens > 0) {
        setDownloadStatus(`Baixando ${counts.imagens} imagens...`)

        await wv.executeJavaScript(`(async function() {
          if (!window.imagensMapeadas) return;

          console.log("Iniciando download das imagens...");

          var imgEntries = [...window.imagensMapeadas.entries()];
          imgEntries.sort(function(a, b) { return a[0] - b[0]; });

          for (var ii = 0; ii < imgEntries.length; ii++) {
            if (window.__downloadCancelled) {
              console.log("Download cancelado pelo usuario.");
              return;
            }

            var take = imgEntries[ii][0];
            var imgSrc = imgEntries[ii][1];

            var formatted = take.toString().padStart(4, '0');

            var response = await fetch(imgSrc);
            var realUrl = response.url;

            var fileResponse = await fetch(realUrl);
            var blob = await fileResponse.blob();

            var contentType = fileResponse.headers.get("content-type") || "";
            var ext = ".png";
            if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = ".jpg";
            else if (contentType.includes("webp")) ext = ".webp";

            var blobUrl = URL.createObjectURL(blob);

            var a = document.createElement("a");
            a.href = blobUrl;
            a.download = "TAKE " + formatted + ext;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(blobUrl);

            console.log("Baixada imagem TAKE", formatted);

            await new Promise(function(r) { setTimeout(r, 1500); });
          }

          console.log("DOWNLOAD DE IMAGENS COMPLETO");
        })()`)
      }

      setDownloadStatus('Concluido!')
      setTimeout(() => {
        setIsDownloading(false)
        setDownloadStatus('')
      }, 2000)
    } catch (err) {
      console.error('[Veo3Toolbar] Download media failed:', err)
      setDownloadStatus('Erro!')
      setTimeout(() => {
        setIsDownloading(false)
        setDownloadStatus('')
      }, 2000)
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

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Download media */}
      {isDownloading ? (
        <button
          onClick={handleStopDownload}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-400 transition-colors hover:bg-white/5"
          title="Parar download"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{downloadStatus}</span>
          <XCircle className="h-3 w-3" />
        </button>
      ) : (
        <button
          onClick={handleDownloadMedia}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-white/5 hover:text-text"
          title="Mapear e baixar todos os videos e imagens com TAKE"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Baixar Midias</span>
        </button>
      )}

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
