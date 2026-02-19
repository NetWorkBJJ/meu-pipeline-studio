import { motion } from 'framer-motion'
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
        <motion.div
          key={scene.id}
          whileHover={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
          transition={{ duration: 0.15 }}
          className="rounded-lg border border-border bg-surface p-4 shadow-surface"
        >
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
              className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text transition-colors focus:border-primary focus:outline-none"
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
              className="flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs text-text placeholder:text-text-muted/40 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
          </div>
          {scene.mediaPath && (
            <p className="mt-1 truncate text-xs text-success">{scene.mediaPath}</p>
          )}
        </motion.div>
      ))}
    </div>
  )
}
