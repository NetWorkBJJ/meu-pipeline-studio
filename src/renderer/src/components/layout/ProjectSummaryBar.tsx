import { useProjectStore } from '@/stores/useProjectStore'

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

export function ProjectSummaryBar(): React.JSX.Element | null {
  const projectSummary = useProjectStore((s) => s.projectSummary)
  const audioCount = useProjectStore((s) => s.audioBlocks.length)
  const textCount = useProjectStore((s) => s.storyBlocks.length)
  const videoCount = useProjectStore((s) => s.videoSegments.length)

  if (!projectSummary) return null

  return (
    <div className="flex items-center gap-4 border-b border-border px-6 py-1.5 text-xs text-text-muted">
      <span className="font-medium text-text">{projectSummary.name || 'Projeto'}</span>
      <div className="h-3 w-px bg-border" />
      <span>{formatDuration(projectSummary.durationMs)}</span>
      <span>{projectSummary.trackCount} tracks</span>
      <div className="h-3 w-px bg-border" />
      <span>{audioCount} audios</span>
      <span>{textCount} textos</span>
      <span>{videoCount} videos</span>
      {projectSummary.canvasWidth > 0 && (
        <>
          <div className="h-3 w-px bg-border" />
          <span>
            {projectSummary.canvasWidth}x{projectSummary.canvasHeight}
          </span>
        </>
      )}
    </div>
  )
}
