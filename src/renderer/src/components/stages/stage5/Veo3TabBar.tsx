import { Plus, X, Home } from 'lucide-react'
import { Reorder } from 'framer-motion'
import { useVeo3AccountStore, useVeo3TabStore } from '@/stores/useVeo3Store'
import type { Veo3Tab } from '@/types/veo3'

interface Veo3TabBarProps {
  onOpenAccountSelector: () => void
}

export function Veo3TabBar({ onOpenAccountSelector }: Veo3TabBarProps): React.JSX.Element | null {
  const { accounts } = useVeo3AccountStore()
  const { tabs, activeTabId, setActiveTab, closeTab, resetTabs, reorderTabs } = useVeo3TabStore()

  if (tabs.length === 0) return null

  return (
    <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border bg-bg px-2">
      {/* Home button */}
      <button
        onClick={resetTabs}
        className="mr-1 flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title="Voltar para contas"
      >
        <Home className="h-3 w-3" />
      </button>

      <div className="mr-1 h-4 w-px bg-border" />

      <Reorder.Group
        axis="x"
        values={tabs}
        onReorder={reorderTabs}
        className="flex items-center gap-0.5"
        as="div"
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            accountName={accounts.find((a) => a.id === tab.accountId)?.name}
            accountColor={accounts.find((a) => a.id === tab.accountId)?.color}
            onSelect={() => setActiveTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
      </Reorder.Group>

      {/* Add tab button */}
      <button
        onClick={onOpenAccountSelector}
        className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/5 hover:text-text"
        title="Abrir nova conta"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}

function TabItem({
  tab,
  isActive,
  accountName,
  accountColor,
  onSelect,
  onClose
}: {
  tab: Veo3Tab
  isActive: boolean
  accountName?: string
  accountColor?: string
  onSelect: () => void
  onClose: () => void
}): React.JSX.Element | null {
  if (!accountName || !accountColor) return null

  return (
    <Reorder.Item
      value={tab}
      onClick={onSelect}
      whileDrag={{ opacity: 0.8, scale: 1.02 }}
      className={`group flex h-7 cursor-grab items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 transition-colors active:cursor-grabbing ${
        isActive
          ? 'border-border bg-surface text-text'
          : 'border-transparent text-text-muted hover:bg-white/5 hover:text-text'
      }`}
      as="div"
    >
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: accountColor }}
      />
      <span className="max-w-[120px] truncate text-[11px] select-none">{accountName}</span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </Reorder.Item>
  )
}
