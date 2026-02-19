import { useState } from 'react'
import { msToDisplay } from '@/lib/time'

interface TimelineSegmentProps {
  id: string
  startMs: number
  durationMs: number
  label: string
  color: string
  pixelsPerSecond: number
  isSelected: boolean
  onSelect: (id: string | null) => void
}

export function TimelineSegment({
  id,
  startMs,
  durationMs,
  label,
  color,
  pixelsPerSecond,
  isSelected,
  onSelect
}: TimelineSegmentProps): React.JSX.Element {
  const [hovered, setHovered] = useState(false)

  const left = (startMs / 1000) * pixelsPerSecond
  const width = Math.max((durationMs / 1000) * pixelsPerSecond, 4)
  const endMs = startMs + durationMs

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    onSelect(isSelected ? null : id)
  }

  return (
    <div
      className={`absolute top-0.5 bottom-0.5 flex cursor-pointer items-center overflow-hidden rounded border px-1.5 text-[10px] leading-none select-none transition-all ${
        isSelected ? 'ring-2 ring-white shadow-lg brightness-125' : ''
      }`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: `${color}cc`,
        borderColor: isSelected ? '#FFFFFF' : color
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {width > 40 && <span className="block w-full truncate text-white/80">{label}</span>}

      {hovered && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-[11px] text-white shadow-lg">
          <div className="font-medium">{label}</div>
          <div className="text-white/70">
            {msToDisplay(startMs)} - {msToDisplay(endMs)}
          </div>
          <div className="text-white/50">{msToDisplay(durationMs)}</div>
        </div>
      )}
    </div>
  )
}
