import { useState, useEffect } from 'react'
import { Play, Pause, Square, AlertTriangle } from 'lucide-react'
import { useVeo3AutomationStore } from '@/stores/useVeo3AutomationStore'
import type { WebviewElement } from '@/types/veo3'

interface SidepanelControlsTabProps {
  webviewRef: React.RefObject<WebviewElement | null>
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return '0s'
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  const min = Math.floor(elapsed / 60)
  const sec = elapsed % 60
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`
}

export function SidepanelControlsTab({
  webviewRef
}: SidepanelControlsTabProps): React.JSX.Element {
  const {
    commands,
    isRunning,
    isPaused,
    currentCommandIndex,
    startedAt,
    error,
    chapterFilter,
    setChapterFilter,
    getProgress,
    getFilteredCommands,
    start,
    pause,
    resume,
    stop
  } = useVeo3AutomationStore()

  const [elapsed, setElapsed] = useState('0s')

  useEffect(() => {
    if (!isRunning || !startedAt) return
    const timer = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000)
    return () => clearInterval(timer)
  }, [isRunning, startedAt])

  const progress = getProgress()
  const filteredCommands = getFilteredCommands()

  const chapters = [...new Set(commands.map((c) => c.chapter))].sort((a, b) => a - b)

  const handleStart = (): void => {
    const wv = webviewRef.current
    if (!wv) return

    start()

    const cmds = getFilteredCommands()
    const payload = JSON.stringify({
      type: 'SIDEPANEL_TO_CONTENT',
      action: 'START_AUTOMATION',
      data: { commands: cmds }
    })
    wv.executeJavaScript(`window.postMessage(${payload}, '*')`)
  }

  const handlePauseResume = (): void => {
    const wv = webviewRef.current
    if (!wv) return

    if (isPaused) {
      resume()
    } else {
      pause()
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
    if (!wv) return

    stop()

    const payload = JSON.stringify({
      type: 'SIDEPANEL_TO_CONTENT',
      action: 'STOP_AUTOMATION',
      data: {}
    })
    wv.executeJavaScript(`window.postMessage(${payload}, '*')`)
  }

  const toggleChapter = (ch: number): void => {
    if (!chapterFilter) {
      setChapterFilter([ch])
      return
    }
    if (chapterFilter.includes(ch)) {
      const next = chapterFilter.filter((c) => c !== ch)
      setChapterFilter(next.length === 0 ? null : next)
    } else {
      setChapterFilter([...chapterFilter, ch])
    }
  }

  const failedCommands = commands.filter((c) => c.status === 'failed')

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Chapter filter */}
      {chapters.length > 1 && (
        <div>
          <span className="text-[11px] font-medium text-text-muted">Distribuicao</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              onClick={() => setChapterFilter(null)}
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

      {/* Action buttons */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={commands.length === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" />
            Iniciar
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
            {isRunning && currentCommandIndex < commands.length && (
              <span className="truncate ml-2 max-w-[150px]">
                #{currentCommandIndex + 1}: {commands[currentCommandIndex]?.prompt.slice(0, 40)}...
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
    </div>
  )
}
