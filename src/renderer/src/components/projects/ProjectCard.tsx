import { useState } from 'react'
import { motion } from 'framer-motion'
import { Film, Check } from 'lucide-react'
import type { PipelineStatus } from '@/types/workspace'

function formatRelativeDate(timestampUs: number): string {
  if (!timestampUs) return ''
  const timestampMs = timestampUs / 1000
  const now = Date.now()
  const diff = now - timestampMs
  if (diff < 0) return 'agora'
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)} sem`
  return `${Math.floor(days / 30)}m`
}

function formatDuration(durationUs: number): string {
  if (!durationUs) return '00:00'
  const totalSeconds = Math.floor(durationUs / 1_000_000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

interface ProjectCardProps {
  name: string
  path: string
  draftPath: string
  durationUs: number
  modifiedUs: number
  cover: string
  exists: boolean
  pipelineStatus: PipelineStatus | null
  multiSelect: boolean
  selected: boolean
  onSelect: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function PipelineMiniStepper({
  status
}: {
  status: PipelineStatus | null
}): React.JSX.Element {
  const completedStages = status?.completedStages || []
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5, 6].map((stage) => {
        const completed = completedStages.includes(stage)
        return (
          <div
            key={stage}
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold ${
              completed
                ? 'bg-primary text-white'
                : 'bg-border/50 text-text-muted/50'
            }`}
          >
            {completed ? <Check className="h-2 w-2" /> : stage}
          </div>
        )
      })}
    </div>
  )
}

export function ProjectCard({
  name,
  durationUs,
  modifiedUs,
  cover,
  exists,
  pipelineStatus,
  multiSelect,
  selected,
  onSelect,
  onClick,
  onContextMenu
}: ProjectCardProps): React.JSX.Element {
  const [imgError, setImgError] = useState(false)

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (multiSelect) {
          onSelect()
        } else if (exists) {
          onClick()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e)
      }}
      className={`group relative flex cursor-pointer flex-col rounded-xl border p-3 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-glow-sm'
          : exists
            ? 'border-border bg-surface hover:border-primary/40 hover:bg-surface-hover hover:shadow-glow-sm'
            : 'cursor-not-allowed border-border/50 bg-surface/50 opacity-50'
      }`}
    >
      {/* Multi-select checkbox */}
      {multiSelect && (
        <div className="absolute left-2 top-2 z-10">
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border ${
              selected
                ? 'border-primary bg-primary text-white'
                : 'border-text-muted/30 bg-bg'
            }`}
          >
            {selected && <Check className="h-2.5 w-2.5" />}
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-lg bg-background">
        {cover && !imgError ? (
          <img
            src={`file:///${cover.replace(/\\/g, '/')}`}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Film className="h-6 w-6 text-text-muted/30" />
        )}
      </div>

      {/* Name */}
      <h3 className="mb-1 truncate text-sm font-medium text-text" title={name}>
        {name || 'Sem nome'}
      </h3>

      {/* Metadata */}
      <div className="mb-2 flex items-center gap-2 text-[10px] text-text-muted/70">
        {durationUs > 0 && <span>{formatDuration(durationUs)}</span>}
        {modifiedUs > 0 && (
          <>
            {durationUs > 0 && <span>|</span>}
            <span>{formatRelativeDate(modifiedUs)}</span>
          </>
        )}
        {!exists && <span className="text-error/70">pasta ausente</span>}
      </div>

      {/* Pipeline progress */}
      <div className="mt-auto">
        <PipelineMiniStepper status={pipelineStatus} />
      </div>
    </motion.div>
  )
}
