import { msToDisplay } from '@/lib/time'

interface Scene {
  id: string
  index: number
  description: string
  startMs: number
  endMs: number
  durationMs: number
  mediaKeyword: string
  mediaType: 'video' | 'photo'
  mediaPath: string | null
  blockIds: string[]
}

interface SceneListProps {
  scenes: Scene[]
  onUpdateScene: (id: string, field: string, value: string) => void
}

export function SceneList({ scenes, onUpdateScene }: SceneListProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {scenes.map((scene) => (
        <div key={scene.id} className="rounded-md border border-border bg-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {scene.index}
              </span>
              <span className="text-xs text-text-muted">
                {msToDisplay(scene.startMs)} - {msToDisplay(scene.endMs)}
              </span>
              <span className="text-xs text-text-muted">({scene.blockIds.length} blocos)</span>
            </div>
            <select
              value={scene.mediaType}
              onChange={(e) => onUpdateScene(scene.id, 'mediaType', e.target.value)}
              className="rounded border border-border bg-bg px-2 py-0.5 text-xs text-text"
            >
              <option value="video">Video</option>
              <option value="photo">Foto</option>
            </select>
          </div>
          <p className="text-xs text-text-muted mb-2 line-clamp-2">{scene.description}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={scene.mediaKeyword}
              onChange={(e) => onUpdateScene(scene.id, 'mediaKeyword', e.target.value)}
              placeholder="Palavra-chave para midia..."
              className="flex-1 rounded border border-border bg-bg px-2 py-1 text-xs text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none"
            />
          </div>
          {scene.mediaPath && (
            <p className="mt-1 truncate text-xs text-success">{scene.mediaPath}</p>
          )}
        </div>
      ))}
    </div>
  )
}
