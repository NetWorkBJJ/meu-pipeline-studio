import { ElevenLabsTTSPanel } from './ElevenLabsTTSPanel'
import { Ai33CreditsBar } from './Ai33CreditsBar'

export function Stage2Audio(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Ai33CreditsBar />
      <ElevenLabsTTSPanel />
    </div>
  )
}
