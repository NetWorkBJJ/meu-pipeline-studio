import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useVeo3AccountStore, useVeo3TabStore } from '@/stores/useVeo3Store'

interface Veo3AccountSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (accountId: string) => void
}

export function Veo3AccountSelector({
  open,
  onClose,
  onSelect
}: Veo3AccountSelectorProps): React.JSX.Element | null {
  const { accounts } = useVeo3AccountStore()
  const { isAccountOpen } = useVeo3TabStore()

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-[360px] rounded-xl border border-border bg-surface shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-text">Selecionar Conta</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            {accounts.length === 0 ? (
              <p className="py-6 text-center text-xs text-text-muted">
                Nenhuma conta cadastrada.
              </p>
            ) : (
              <div className="space-y-1.5">
                {accounts.map((account) => {
                  const busy = isAccountOpen(account.id)
                  return (
                    <button
                      key={account.id}
                      onClick={() => {
                        if (!busy) {
                          onSelect(account.id)
                          onClose()
                        }
                      }}
                      disabled={busy}
                      className={`flex w-full items-center gap-3 rounded-lg border border-border px-3 py-3 text-left transition-colors ${
                        busy
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:border-primary/40 hover:bg-white/5'
                      }`}
                    >
                      <div
                        className="h-3.5 w-3.5 shrink-0 rounded-full"
                        style={{ backgroundColor: account.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-text">
                          {account.name}
                        </span>
                        {account.description && (
                          <span className="block truncate text-[10px] text-text-muted">
                            {account.description}
                          </span>
                        )}
                      </div>
                      {busy && (
                        <span className="shrink-0 text-[10px] text-text-muted">em uso</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
