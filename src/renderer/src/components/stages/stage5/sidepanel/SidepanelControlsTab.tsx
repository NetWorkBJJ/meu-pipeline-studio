import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Square, AlertTriangle, Loader2, Timer, FolderOpen, ExternalLink, RotateCw, SkipForward } from 'lucide-react'
import { useVeo3AutomationStore, DEFAULT_TAB_AUTOMATION } from '@/stores/useVeo3AutomationStore'
import { useVeo3Store } from '@/stores/useVeo3Store'
import { useProjectStore } from '@/stores/useProjectStore'
import type { WebviewElement, FlowCommand } from '@/types/veo3'

interface SidepanelControlsTabProps {
  webviewRef: React.RefObject<WebviewElement | null>
  tabId: string | null
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return '0s'
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  const min = Math.floor(elapsed / 60)
  const sec = elapsed % 60
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`
}

export function SidepanelControlsTab({
  webviewRef,
  tabId
}: SidepanelControlsTabProps): React.JSX.Element {
  const {
    commands,
    tabStates,
    loadFromProject,
    startTab,
    pauseTab,
    resumeTab,
    stopTab,
    assignCommandsToTab,
    setChapterFilter,
    getFilteredCommands,
    getProgress
  } = useVeo3AutomationStore()

  const tabState = (tabId ? tabStates[tabId] : null) || DEFAULT_TAB_AUTOMATION
  const { isRunning, isPaused, currentCommandIndex, startedAt, error, chapterFilter, batchPause, retryState } = tabState

  const [elapsed, setElapsed] = useState('0s')
  const [countdownSeconds, setCountdownSeconds] = useState(0)
  const [startFromIndex, setStartFromIndex] = useState(0)

  useEffect(() => {
    if (!isRunning || !startedAt) return
    const timer = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000)
    return () => clearInterval(timer)
  }, [isRunning, startedAt])

  useEffect(() => {
    if (!batchPause) {
      setCountdownSeconds(0)
      return
    }
    const tick = (): void => {
      const remaining = Math.max(0, Math.ceil((batchPause.pauseEndsAt - Date.now()) / 1000))
      setCountdownSeconds(remaining)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [batchPause])

  useEffect(() => {
    setStartFromIndex(0)
  }, [chapterFilter])

  const progress = getProgress(tabId)
  const filteredCommands = getFilteredCommands(tabId)

  const chapters = [...new Set(commands.map((c) => c.chapter))].sort((a, b) => a - b)

  const downloadPath = useVeo3Store((s) => s.downloadPath)
  const setDownloadPath = useVeo3Store((s) => s.setDownloadPath)

  useEffect(() => {
    window.api.veo3GetDownloadPath().then((path) => {
      if (path) setDownloadPath(path)
    })
  }, [setDownloadPath])

  const handleChangeDownloadFolder = async (): Promise<void> => {
    const selected = await window.api.selectDirectory()
    if (selected) {
      await window.api.veo3SetDownloadPath(selected)
      setDownloadPath(selected)
    }
  }

  const handleOpenDownloadFolder = async (): Promise<void> => {
    if (downloadPath) {
      await window.api.openInExplorer(downloadPath)
    }
  }

  const [isPreparingImages, setIsPreparingImages] = useState(false)
  const handleStart = async (): Promise<void> => {
    if (!tabId) {
      console.error('[SidepanelControls] No tabId available')
      useVeo3AutomationStore.setState({
        tabStates: {
          ...useVeo3AutomationStore.getState().tabStates,
          __global: { ...DEFAULT_TAB_AUTOMATION, error: 'Nenhuma aba ativa. Abra uma aba primeiro.' }
        }
      })
      return
    }

    const wv = webviewRef.current
    if (!wv) {
      console.error('[SidepanelControls] webviewRef.current is null for tab:', tabId)
      stopTab(tabId, 'Webview nao disponivel. Aguarde a pagina carregar.')
      return
    }

    // Auto-load if commands are empty but scenes exist
    let cmds = getFilteredCommands(tabId)
    if (cmds.length === 0) {
      loadFromProject()
      cmds = useVeo3AutomationStore.getState().getFilteredCommands(tabId)
      if (cmds.length === 0) {
        stopTab(tabId, 'Nenhuma cena com prompt disponivel. Verifique o Stage 4.')
        return
      }
    }

    // Assign unassigned commands to this tab
    assignCommandsToTab(tabId)
    const tabCmds = useVeo3AutomationStore
      .getState()
      .commands.filter((c) => c.tabId === tabId)

    if (tabCmds.length === 0) {
      stopTab(tabId, 'Nenhum comando atribuido a esta aba.')
      return
    }

    // Slice commands from selected start index
    const startCmds = startFromIndex > 0 ? tabCmds.slice(startFromIndex) : tabCmds

    if (startCmds.length === 0) {
      stopTab(tabId, 'Nenhum comando a partir do take selecionado.')
      return
    }

    console.log(`[SidepanelControls] Starting automation from take ${startFromIndex + 1}: ${startCmds.length} commands for tab ${tabId}`)

    // Enrich character images with data URLs before sending to webview
    setIsPreparingImages(true)
    let enrichedCmds: FlowCommand[]
    let allCharacterImages: Array<{
      characterId: string
      name: string
      imagePath: string
      dataUrl: string
      fileName: string
    }> = []
    try {
      enrichedCmds = await enrichCommandsWithImageData(startCmds)
      // Load ALL character images from project (not just matched ones)
      allCharacterImages = await loadAllCharacterImages()
      console.log(`[SidepanelControls] Loaded ${allCharacterImages.length} character images for upload`)
    } catch (err) {
      console.error('[SidepanelControls] Failed to enrich images:', err)
      enrichedCmds = startCmds
    } finally {
      setIsPreparingImages(false)
    }

    // Attach CDP to webview for trusted input events (fill prompt + submit)
    try {
      const wcId = wv.getWebContentsId()
      console.log(`[SidepanelControls] Attaching CDP to webContentsId: ${wcId}`)
      const attachResult = await window.api.cdpAttach(wcId)
      if (!attachResult.success) {
        console.warn(`[SidepanelControls] CDP attach failed: ${attachResult.error} (will use DOM fallback)`)
      } else {
        console.log('[SidepanelControls] CDP attached successfully')
      }
    } catch (err) {
      console.warn('[SidepanelControls] CDP attach error:', err, '(will use DOM fallback)')
    }

    startTab(tabId, startFromIndex)

    try {
      // Step 1: Pre-load images into webview cache (one at a time, ~500KB each)
      // This avoids sending a massive 8MB+ payload via a single executeJavaScript call
      console.log(`[SidepanelControls] Pre-loading ${allCharacterImages.length} images into webview...`)
      await wv.executeJavaScript('window.__veo3_imageCache = {}')
      for (let i = 0; i < allCharacterImages.length; i++) {
        const img = allCharacterImages[i]
        const imgPayload = JSON.stringify({ dataUrl: img.dataUrl, fileName: img.fileName })
        await wv.executeJavaScript(
          `window.__veo3_imageCache[${JSON.stringify(img.characterId)}] = ${imgPayload}`
        )
        console.log(
          `[SidepanelControls] Image ${i + 1}/${allCharacterImages.length}: ${img.fileName}`
        )
      }

      // Step 2: Send lightweight metadata via postMessage (NO base64 data)
      const lightCommands = enrichedCmds.map((cmd) => ({
        ...cmd,
        characterImages: cmd.characterImages.map((ci) => ({
          ...ci,
          image: ci.image ? { name: ci.image.name } : undefined
        }))
      }))

      const lightCharImages = allCharacterImages.map((img) => ({
        characterId: img.characterId,
        name: img.name,
        fileName: img.fileName
      }))

      const payload = JSON.stringify({
        type: 'SIDEPANEL_TO_CONTENT',
        action: 'START_AUTOMATION',
        data: {
          commands: lightCommands,
          allCharacterImages: lightCharImages
        }
      })

      await wv.executeJavaScript(`window.postMessage(${payload}, '*')`)
      console.log('[SidepanelControls] START_AUTOMATION sent (metadata only, images pre-loaded)')
    } catch (err) {
      console.error('[SidepanelControls] executeJavaScript failed:', err)
      stopTab(tabId, 'Falha ao enviar comandos para o webview.')
    }
  }

  const handlePauseResume = (): void => {
    const wv = webviewRef.current
    if (!wv || !tabId) return

    if (isPaused) {
      resumeTab(tabId)
    } else {
      pauseTab(tabId)
    }

    const payload = JSON.stringify({
      type: 'SIDEPANEL_TO_CONTENT',
      action: 'TOGGLE_PAUSE',
      data: {}
    })
    wv.executeJavaScript(`window.postMessage(${payload}, '*')`)
  }

  const handleStop = (): void => {
    const wv = webviewRef.current
    if (!wv || !tabId) return

    stopTab(tabId)

    const payload = JSON.stringify({
      type: 'SIDEPANEL_TO_CONTENT',
      action: 'STOP_AUTOMATION',
      data: {}
    })
    wv.executeJavaScript(`window.postMessage(${payload}, '*')`)
  }

  const toggleChapter = (ch: number): void => {
    if (!tabId) return
    if (!chapterFilter) {
      setChapterFilter(tabId, [ch])
      return
    }
    if (chapterFilter.includes(ch)) {
      const next = chapterFilter.filter((c) => c !== ch)
      setChapterFilter(tabId, next.length === 0 ? null : next)
    } else {
      setChapterFilter(tabId, [...chapterFilter, ch])
    }
  }

  const isStartDisabled = commands.length === 0 || isPreparingImages

  const tabCommands = tabId
    ? commands.filter((c) => c.tabId === tabId)
    : commands
  const failedCommands = tabCommands.filter((c) => c.status === 'failed')

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Chapter filter */}
      {chapters.length > 1 && (
        <div>
          <span className="text-[11px] font-medium text-text-muted">Distribuicao</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => tabId && setChapterFilter(tabId, null)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                !chapterFilter
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-text-muted hover:bg-white/10'
              }`}
            >
              Todas
            </button>
            {chapters.map((ch) => (
              <button
                key={ch}
                onClick={() => toggleChapter(ch)}
                className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                  chapterFilter?.includes(ch)
                    ? 'bg-primary text-white'
                    : 'bg-white/5 text-text-muted hover:bg-white/10'
                }`}
              >
                Ch. {ch}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-text-muted">
            {filteredCommands.length} de {commands.length} cenas selecionadas
          </p>
        </div>
      )}

      {/* Start from take selector */}
      {!isRunning && filteredCommands.length > 1 && (
        <div>
          <div className="flex items-center gap-1.5">
            <SkipForward className="h-3 w-3 text-text-muted" />
            <span className="text-[11px] font-medium text-text-muted">Iniciar a partir de</span>
          </div>
          <select
            value={startFromIndex}
            onChange={(e) => setStartFromIndex(Number(e.target.value))}
            className="mt-1.5 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-[11px] text-text transition-colors hover:border-primary/40 focus:border-primary focus:outline-none"
          >
            {filteredCommands.map((cmd, idx) => (
              <option key={cmd.id} value={idx}>
                Take {cmd.sceneIndex + 1} — {cmd.prompt.slice(0, 40)}{cmd.prompt.length > 40 ? '...' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={isStartDisabled}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            {isPreparingImages ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando imagens...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Iniciar
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={handlePauseResume}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                isPaused
                  ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                  : 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25'
              }`}
            >
              <Pause className="h-3.5 w-3.5" />
              {isPaused ? 'Retomar' : 'Pausar'}
            </button>
            <button
              onClick={handleStop}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
            >
              <Square className="h-3.5 w-3.5" />
              Parar
            </button>
          </>
        )}
      </div>

      {/* Batch pause countdown */}
      <AnimatePresence>
        {batchPause && countdownSeconds >= 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-medium text-amber-400">
                    Pausa entre lotes
                  </span>
                </div>
                <span className="text-[10px] text-amber-400/70">
                  Lote {batchPause.batch}/{batchPause.totalBatches}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-mono text-lg font-semibold text-amber-400">
                  {Math.floor(countdownSeconds / 60)}:{String(countdownSeconds % 60).padStart(2, '0')}
                </span>
                <span className="text-[10px] text-text-muted">
                  30s fixo
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-amber-500/10">
                <motion.div
                  className="h-full rounded-full bg-amber-500/60"
                  initial={false}
                  animate={{
                    width: `${batchPause.totalSeconds > 0 ? (countdownSeconds / batchPause.totalSeconds) * 100 : 0}%`
                  }}
                  transition={{ duration: 0.8, ease: 'linear' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Retry countdown */}
      <AnimatePresence>
        {retryState && retryState.failedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
              <div className="flex items-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[11px] font-medium text-orange-400">
                  Retry: {retryState.failedCount} tile{retryState.failedCount !== 1 ? 's' : ''} com falha
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      {(isRunning || progress.completed > 0) && (
        <div className="rounded-lg border border-border bg-bg p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Progresso</span>
            <span className="font-medium text-text">
              {progress.completed}/{progress.total}
            </span>
          </div>
          {progress.total > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
            <span>Tempo: {elapsed}</span>
            {isRunning && currentCommandIndex < tabCommands.length && (
              <span className="truncate ml-2 max-w-[150px]">
                #{currentCommandIndex + 1}: {tabCommands[currentCommandIndex]?.prompt.slice(0, 40)}...
              </span>
            )}
          </div>
          {progress.failed > 0 && (
            <p className="mt-1 text-[10px] text-red-400">
              {progress.failed} falha{progress.failed !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Error log */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}

      {failedCommands.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-text-muted">Erros recentes</span>
          <div className="mt-1.5 space-y-1">
            {failedCommands.slice(0, 5).map((cmd) => (
              <div
                key={cmd.id}
                className="rounded border border-red-500/10 bg-red-500/5 px-2 py-1.5 text-[10px] text-red-400"
              >
                <span className="font-mono">#{cmd.sceneIndex + 1}</span> {cmd.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download folder */}
      <div className="border-t border-border pt-3">
        <span className="text-[11px] font-medium text-text-muted">Pasta de downloads</span>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button
            onClick={handleOpenDownloadFolder}
            disabled={!downloadPath}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-white/[0.02] disabled:opacity-40"
            title={downloadPath || 'Nenhuma pasta definida'}
          >
            <FolderOpen className="h-3 w-3 shrink-0 text-text-muted" />
            <span className="truncate text-[11px] text-text-muted">
              {downloadPath
                ? downloadPath.split(/[\\/]/).slice(-2).join('/')
                : 'Nao definida'}
            </span>
            <ExternalLink className="ml-auto h-2.5 w-2.5 shrink-0 text-text-muted/50" />
          </button>
          <button
            onClick={handleChangeDownloadFolder}
            className="shrink-0 rounded-md border border-border bg-bg px-2 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:text-text"
            title="Alterar pasta"
          >
            Alterar
          </button>
        </div>
      </div>

    </div>
  )
}

async function loadAllCharacterImages(): Promise<
  Array<{ characterId: string; name: string; imagePath: string; dataUrl: string; fileName: string }>
> {
  const { characterRefs } = useProjectStore.getState()
  const result: Array<{
    characterId: string
    name: string
    imagePath: string
    dataUrl: string
    fileName: string
  }> = []

  for (const ref of characterRefs) {
    if (!ref.imagePath) continue
    try {
      const dataUrl = await window.api.veo3ReadImageAsDataUrl(ref.imagePath)
      if (dataUrl) {
        const fileName = ref.imagePath.split(/[\\/]/).pop() || `${ref.name}.png`
        result.push({
          characterId: ref.id,
          name: ref.name,
          imagePath: ref.imagePath,
          dataUrl,
          fileName
        })
      }
    } catch (err) {
      console.warn(`[loadAllCharacterImages] Failed to read: ${ref.imagePath}`, err)
    }
  }

  return result
}

async function enrichCommandsWithImageData(cmds: FlowCommand[]): Promise<FlowCommand[]> {
  const imageCache = new Map<string, string>()

  for (const cmd of cmds) {
    for (const img of cmd.characterImages) {
      if (img.imagePath && !imageCache.has(img.imagePath)) {
        try {
          const dataUrl = await window.api.veo3ReadImageAsDataUrl(img.imagePath)
          if (dataUrl) {
            imageCache.set(img.imagePath, dataUrl)
          }
        } catch (err) {
          console.warn(`[enrichImages] Failed to read: ${img.imagePath}`, err)
        }
      }
    }
  }

  if (imageCache.size === 0) return cmds

  return cmds.map((cmd) => ({
    ...cmd,
    characterImages: cmd.characterImages.map((img) => ({
      ...img,
      image:
        img.imagePath && imageCache.has(img.imagePath)
          ? {
              dataUrl: imageCache.get(img.imagePath)!,
              name: img.imagePath.split(/[\\/]/).pop() || `${img.name}.png`
            }
          : undefined
    }))
  }))
}
