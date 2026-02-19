import { Video, Mic, Captions } from 'lucide-react'
import { TimelineSegment } from './TimelineSegment'

interface Segment {
  id: string
  startMs: number
  durationMs: number
  label: string
}

type TrackType = 'text' | 'video' | 'audio'

interface TimelineTrackProps {
  label: string
  type: TrackType
  segments: Segment[]
  color: string
  totalWidthPx: number
  pixelsPerSecond: number
  selectedSegmentId: string | null
  onSelectSegment: (id: string | null) => void
}

const trackIcons = {
  text: Captions,
  video: Video,
  audio: Mic
}

export function TimelineTrack({
  label,
  type,
  segments,
  color,
  totalWidthPx,
  pixelsPerSecond,
  selectedSegmentId,
  onSelectSegment
}: TimelineTrackProps): React.JSX.Element {
  const Icon = trackIcons[type]

  return (
    <div className="flex h-10 min-h-10 border-b border-border/30">
      {/* Track Header */}
      <div
        className="flex w-[100px] min-w-[100px] items-center gap-2 border-r border-border px-2"
        style={{
          borderLeftWidth: 3,
          borderLeftColor: color,
          borderLeftStyle: 'solid',
          backgroundColor: '#111113'
        }}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          {label}
        </span>
      </div>

      {/* Track Content */}
      <div
        className="relative flex-1"
        style={{
          width: `${totalWidthPx}px`,
          minWidth: `${totalWidthPx}px`,
          backgroundColor: '#111113'
        }}
      >
        {segments.map((seg) => (
          <TimelineSegment
            key={seg.id}
            id={seg.id}
            startMs={seg.startMs}
            durationMs={seg.durationMs}
            label={seg.label}
            color={color}
            pixelsPerSecond={pixelsPerSecond}
            isSelected={seg.id === selectedSegmentId}
            onSelect={onSelectSegment}
          />
        ))}
      </div>
    </div>
  )
}
