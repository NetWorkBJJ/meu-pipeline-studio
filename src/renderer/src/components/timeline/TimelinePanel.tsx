import { useRef, useMemo, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useUIStore } from '@/stores/useUIStore'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'

// CapCut native track colors
const TRACK_COLORS = {
  text: '#9c4937',
  video: '#175d62',
  audio: '#0e3058'
}

const DEFAULT_ZOOM = 20
const MIN_ZOOM = 5
const MAX_ZOOM = 200

export function TimelinePanel(): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { storyBlocks, audioBlocks, videoSegments: capCutVideos } = useProjectStore()
  const {
    timelineOpen,
    timelineZoom,
    selectedSegmentId,
    setTimelineOpen,
    setTimelineZoom,
    setSelectedSegment
  } = useUIStore()

  const hasData =
    storyBlocks.length > 0 ||
    audioBlocks.length > 0 ||
    capCutVideos.length > 0

  const totalDurationMs = useMemo(() => {
    return Math.max(
      storyBlocks.length > 0 ? Math.max(...storyBlocks.map((b) => b.endMs)) : 0,
      audioBlocks.length > 0 ? Math.max(...audioBlocks.map((b) => b.endMs)) : 0,
      capCutVideos.length > 0 ? Math.max(...capCutVideos.map((v) => v.endMs)) : 0,
      1000
    )
  }, [storyBlocks, audioBlocks, capCutVideos])

  const totalWidthPx = (totalDurationMs / 1000) * timelineZoom

  const textSegments = useMemo(
    () =>
      storyBlocks.map((b) => ({
        id: b.id,
        startMs: b.startMs,
        durationMs: b.durationMs,
        label: b.text
      })),
    [storyBlocks]
  )

  const capCutVideoSegments = useMemo(
    () =>
      capCutVideos.map((v) => ({
        id: v.id,
        startMs: v.startMs,
        durationMs: v.durationMs,
        label: v.filePath.split(/[/\\]/).pop() || `Video ${v.index}`
      })),
    [capCutVideos]
  )

  const audioSegments = useMemo(
    () =>
      audioBlocks.map((b) => ({
        id: b.id,
        startMs: b.startMs,
        durationMs: b.durationMs,
        label: `Audio ${b.index}`
      })),
    [audioBlocks]
  )

  const trackCount =
    (textSegments.length > 0 ? 1 : 0) +
    (capCutVideoSegments.length > 0 ? 1 : 0) +
    (audioSegments.length > 0 ? 1 : 0)

  const handleZoomIn = useCallback((): void => {
    setTimelineZoom(Math.min(timelineZoom * 1.25, MAX_ZOOM))
  }, [timelineZoom, setTimelineZoom])

  const handleZoomOut = useCallback((): void => {
    setTimelineZoom(Math.max(timelineZoom / 1.25, MIN_ZOOM))
  }, [timelineZoom, setTimelineZoom])

  const handleResetZoom = useCallback((): void => {
    setTimelineZoom(DEFAULT_ZOOM)
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0
    }
  }, [setTimelineZoom])

  const handleFitToView = useCallback((): void => {
    if (scrollRef.current) {
      const containerWidth = scrollRef.current.clientWidth - 100
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, containerWidth / (totalDurationMs / 1000))
      )
      setTimelineZoom(newZoom)
      scrollRef.current.scrollLeft = 0
    }
  }, [totalDurationMs, setTimelineZoom])

  const handleWheel = useCallback(
    (e: WheelEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) {
          setTimelineZoom(Math.min(timelineZoom * 1.15, MAX_ZOOM))
        } else {
          setTimelineZoom(Math.max(timelineZoom / 1.15, MIN_ZOOM))
        }
      }
    },
    [timelineZoom, setTimelineZoom]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleBackgroundClick = useCallback((): void => {
    setSelectedSegment(null)
  }, [setSelectedSegment])

  return (
    <div className="flex flex-col border-t border-border bg-bg">
      {/* Header / Toggle */}
      <div
        className="flex h-8 cursor-pointer items-center justify-between px-3 text-xs transition-colors hover:bg-surface"
        onClick={() => setTimelineOpen(!timelineOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setTimelineOpen(!timelineOpen)
          }
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`h-3 w-3 text-text-muted transition-transform ${timelineOpen ? 'rotate-0' : '-rotate-90'}`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M2 4l4 4 4-4z" />
          </svg>
          <span className="font-medium text-text-muted">Timeline</span>
          {!hasData && <span className="text-text-muted/50">- Nenhum dado</span>}
        </div>

        {timelineOpen && (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-border hover:text-white"
              onClick={handleZoomOut}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(Number(e.target.value))}
              className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
            />

            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-border hover:text-white"
              onClick={handleZoomIn}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <div className="mx-0.5 h-3 w-px bg-border" />

            <span className="w-12 text-center text-[10px] text-text-muted">
              {Math.round(timelineZoom)}px/s
            </span>

            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-border hover:text-white"
              onClick={handleResetZoom}
              title="Resetar zoom"
            >
              <RotateCcw className="h-3 w-3" />
            </button>

            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-border hover:text-white"
              onClick={handleFitToView}
              title="Ajustar a tela"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {timelineOpen && (
        <>
          <div
            ref={scrollRef}
            className="overflow-x-auto overflow-y-hidden"
            onClick={handleBackgroundClick}
          >
            {hasData ? (
              <>
                <TimelineRuler
                  totalDurationMs={totalDurationMs}
                  pixelsPerSecond={timelineZoom}
                  totalWidthPx={totalWidthPx}
                />
                {textSegments.length > 0 && (
                  <TimelineTrack
                    label="Texto"
                    type="text"
                    segments={textSegments}
                    color={TRACK_COLORS.text}
                    totalWidthPx={totalWidthPx}
                    pixelsPerSecond={timelineZoom}
                    selectedSegmentId={selectedSegmentId}
                    onSelectSegment={setSelectedSegment}
                  />
                )}
                {capCutVideoSegments.length > 0 && (
                  <TimelineTrack
                    label="Video (CapCut)"
                    type="video"
                    segments={capCutVideoSegments}
                    color={TRACK_COLORS.video}
                    totalWidthPx={totalWidthPx}
                    pixelsPerSecond={timelineZoom}
                    selectedSegmentId={selectedSegmentId}
                    onSelectSegment={setSelectedSegment}
                  />
                )}
                {audioSegments.length > 0 && (
                  <TimelineTrack
                    label="Audio"
                    type="audio"
                    segments={audioSegments}
                    color={TRACK_COLORS.audio}
                    totalWidthPx={totalWidthPx}
                    pixelsPerSecond={timelineZoom}
                    selectedSegmentId={selectedSegmentId}
                    onSelectSegment={setSelectedSegment}
                  />
                )}
              </>
            ) : (
              <div className="flex h-20 items-center justify-center text-xs text-text-muted/50">
                Nenhum dado na timeline. Avance nas etapas para visualizar.
              </div>
            )}
          </div>

          {hasData && (
            <div className="flex items-center justify-between border-t border-border px-3 py-1 text-[10px] text-text-muted">
              <span>
                {trackCount} track{trackCount !== 1 ? 's' : ''} |{' '}
                {(totalDurationMs / 1000).toFixed(1)}s total
              </span>
              <span>Ctrl+Scroll para zoom</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
