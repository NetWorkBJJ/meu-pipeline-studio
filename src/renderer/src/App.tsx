import { AppLayout } from './components/layout/AppLayout'
import { ToastContainer } from './components/shared/Toast'
import { useStageStore } from './stores/useStageStore'
import { Stage1Script } from './components/stages/stage1/Stage1Script'
import { Stage2Audio } from './components/stages/stage2/Stage2Audio'
import { Stage3Sync } from './components/stages/stage3/Stage3Sync'
import { Stage4Director } from './components/stages/stage4/Stage4Director'
import { Stage5Media } from './components/stages/stage5/Stage5Media'
import { Stage6Insert } from './components/stages/stage6/Stage6Insert'

function StageContent(): React.JSX.Element {
  const { currentStage } = useStageStore()

  switch (currentStage) {
    case 1:
      return <Stage1Script />
    case 2:
      return <Stage2Audio />
    case 3:
      return <Stage3Sync />
    case 4:
      return <Stage4Director />
    case 5:
      return <Stage5Media />
    case 6:
      return <Stage6Insert />
    default:
      return <Stage1Script />
  }
}

export function App(): React.JSX.Element {
  return (
    <AppLayout>
      <StageContent />
      <ToastContainer />
    </AppLayout>
  )
}
