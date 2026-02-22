import type { Scene } from '@/types/project'

interface SceneTimelineProps {
  scenes: Scene[]
  totalDurationMs: number
}

export function SceneTimeline({ scenes, totalDurationMs }: SceneTimelineProps): React.JSX.Element {
  if (scenes.length === 0 || totalDurationMs <= 0) {
    return (
      <div className="h-8 rounded-lg border border-border bg-surface flex items-center justify-center">
        <span className="text-[10px] text-text-muted">Nenhuma cena planejada</span>
      </div>
    )
  }

  const timelineStart = scenes[0].startMs

  return (
    <div className="rounded-lg border border-border bg-bg p-2">
      <div className="relative h-6 w-full rounded overflow-hidden bg-surface">
        {scenes.map((scene) => {
          const left = ((scene.startMs - timelineStart) / totalDurationMs) * 100
          const width = (scene.durationMs / totalDurationMs) * 100

          return (
            <div
              key={scene.id}
              className={`absolute top-0 h-full flex items-center justify-center text-[8px] font-medium text-white/80 border-r border-bg/30 ${
                scene.mediaType === 'video'
                  ? scene.mediaPath
                    ? 'bg-teal-500/80'
                    : 'bg-teal-500/40'
                  : scene.mediaPath
                    ? 'bg-violet-500/80'
                    : 'bg-violet-500/40'
              }`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.5)}%`
              }}
              title={`Cena ${scene.index}: ${(scene.durationMs / 1000).toFixed(1)}s (${scene.mediaType})`}
            >
              {width > 3 && scene.index}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-text-muted">0s</span>
        <span className="text-[9px] text-text-muted">
          {(totalDurationMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  )
}
