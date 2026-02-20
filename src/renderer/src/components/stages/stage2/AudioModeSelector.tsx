import { motion } from 'framer-motion'
import { Music, Mic2 } from 'lucide-react'

type AudioMode = 'capcut' | 'tts'

interface AudioModeSelectorProps {
  mode: AudioMode
  onModeChange: (mode: AudioMode) => void
}

const tabs: Array<{ id: AudioMode; label: string; icon: typeof Music }> = [
  { id: 'capcut', label: 'Audio do CapCut', icon: Music },
  { id: 'tts', label: 'Gerar com TTS', icon: Mic2 }
]

export function AudioModeSelector({ mode, onModeChange }: AudioModeSelectorProps): React.JSX.Element {
  return (
    <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = mode === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onModeChange(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="audio-mode-indicator"
                className="absolute inset-0 rounded-md bg-primary"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
