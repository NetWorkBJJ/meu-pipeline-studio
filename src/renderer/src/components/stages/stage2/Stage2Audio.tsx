import { useState } from 'react'
import { GoogleTTSPanel } from './GoogleTTSPanel'
import { ElevenLabsTTSPanel } from './ElevenLabsTTSPanel'
import { MiniMaxTTSPanel } from './MiniMaxTTSPanel'
import { Ai33CreditsBar } from './Ai33CreditsBar'

type TtsTab = 'google' | 'elevenlabs' | 'minimax'

const TABS: Array<{ id: TtsTab; label: string }> = [
  { id: 'google', label: 'Google TTS' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'minimax', label: 'MiniMax' }
]

export function Stage2Audio(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TtsTab>('google')
  const isAi33Tab = activeTab === 'elevenlabs' || activeTab === 'minimax'

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:bg-bg hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Credits bar (visible for ai33 tabs) */}
      {isAi33Tab && <Ai33CreditsBar />}

      {/* Tab content */}
      {activeTab === 'google' && <GoogleTTSPanel />}
      {activeTab === 'elevenlabs' && <ElevenLabsTTSPanel />}
      {activeTab === 'minimax' && <MiniMaxTTSPanel />}
    </div>
  )
}
