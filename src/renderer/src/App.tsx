import { AppLayout } from './components/layout/AppLayout'
import { ToastContainer } from './components/shared/Toast'

export function App(): React.JSX.Element {
  return (
    <>
      <AppLayout />
      <ToastContainer />
    </>
  )
}
