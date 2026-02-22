import { motion } from 'framer-motion'
import { Film, ImageIcon, Clock, Hash, AlertCircle, CheckCircle2 } from 'lucide-react'
import { msToDisplay } from '@/lib/time'
import type { Scene, StoryBlock } from '@/types/project'

interface SceneCardProps {
  scene: Scene
  blocks?: StoryBlock[]
  showPrompt?: boolean
  showMedia?: boolean
  onUpdate?: (id: string, updates: Partial<Scene>) => void
  onClick?: (id: string) => void
  isSelected?: boolean
  compact?: boolean
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  pending: { color: 'text-yellow-400 bg-yellow-400/10', label: 'Pendente' },
  generated: { color: 'text-blue-400 bg-blue-400/10', label: 'Gerado' },
  imported: { color: 'text-green-400 bg-green-400/10', label: 'Importado' },
  failed: { color: 'text-red-400 bg-red-400/10', label: 'Falhou' },
  skipped: { color: 'text-text-muted bg-surface', label: 'Pulado' }
}

export function SceneCard({
  scene,
  blocks,
  showPrompt = false,
  showMedia = false,
  onUpdate,
  onClick,
  isSelected = false,
  compact = false
}: SceneCardProps): React.JSX.Element {
  const isVideo = scene.mediaType === 'video'
  const status = STATUS_STYLES[scene.generationStatus] || STATUS_STYLES.pending
  const sceneBlocks = blocks?.filter((b) => scene.blockIds.includes(b.id)) || []
  const blockText = sceneBlocks.map((b) => b.text).join(' ') || scene.description

  return (
    <motion.div
      whileHover={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
      transition={{ duration: 0.15 }}
      onClick={() => onClick?.(scene.id)}
      className={`rounded-lg border bg-surface p-3 shadow-surface transition-all ${
        isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-border'
      } ${onClick ? 'cursor-pointer' : ''} ${
        isVideo ? 'border-l-2 border-l-teal-500/50' : 'border-l-2 border-l-violet-500/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
            {scene.index}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <Clock className="h-3 w-3" />
            {msToDisplay(scene.startMs)} - {msToDisplay(scene.endMs)}
          </div>
          <span className="text-[10px] text-text-muted">
            ({(scene.durationMs / 1000).toFixed(1)}s)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {showMedia && (
            <span className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${status.color}`}>
              {scene.mediaPath ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : (
                <AlertCircle className="h-2.5 w-2.5" />
              )}
              {status.label}
            </span>
          )}
          <span
            className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isVideo
                ? 'bg-teal-500/10 text-teal-400'
                : 'bg-violet-500/10 text-violet-400'
            }`}
          >
            {isVideo ? <Film className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
            {isVideo ? 'Video' : 'Foto'}
          </span>
          <span className="flex items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted">
            <Hash className="h-2.5 w-2.5" />
            {scene.filenameHint || `scene_${String(scene.index).padStart(3, '0')}`}
          </span>
        </div>
      </div>

      {/* Block text */}
      <p className={`text-xs text-text-muted ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
        {blockText}
      </p>

      {/* Editable fields */}
      {onUpdate && !compact && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={scene.mediaType}
            onChange={(e) => {
              const mediaType = e.target.value as 'video' | 'photo'
              onUpdate(scene.id, {
                mediaType,
                platform: mediaType === 'video' ? 'vo3' : 'nano-banana-pro'
              })
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text transition-colors focus:border-primary focus:outline-none"
          >
            <option value="video">Video (VO3)</option>
            <option value="photo">Foto (Nano Banana)</option>
          </select>
        </div>
      )}

      {/* Prompt preview */}
      {showPrompt && scene.prompt && (
        <div className="mt-2 rounded border border-border/50 bg-bg/50 p-2">
          <p className="text-[11px] text-text-muted line-clamp-3">{scene.prompt}</p>
        </div>
      )}

      {/* Media path */}
      {showMedia && scene.mediaPath && (
        <p className="mt-1.5 truncate text-[10px] font-mono text-green-400">
          {scene.mediaPath.split(/[/\\]/).pop()}
        </p>
      )}
    </motion.div>
  )
}
