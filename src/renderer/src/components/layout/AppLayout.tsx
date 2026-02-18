import { Sidebar } from './Sidebar'
import { StageHeader } from './StageHeader'
import { StatusBar } from './StatusBar'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <StageHeader />
        <main className="flex-1 overflow-auto p-4">{children}</main>
        <StatusBar />
      </div>
    </div>
  )
}
