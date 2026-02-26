import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Pencil, Trash2, Star } from 'lucide-react'
import { useVeo3AccountStore } from '@/stores/useVeo3Store'
import { useVeo3TabStore } from '@/stores/useVeo3Store'

const ACCOUNT_COLORS = ['#4285F4', '#EA4335', '#34A853', '#FBBC04', '#8B5CF6']
const MAX_ACCOUNTS = 5

interface Veo3AccountManagerProps {
  open: boolean
  onClose: () => void
}

export function Veo3AccountManager({ open, onClose }: Veo3AccountManagerProps): React.JSX.Element | null {
  const { accounts, defaultAccountId, addAccount, updateAccount, removeAccount, setDefaultAccount } =
    useVeo3AccountStore()
  const { closeTab, tabs } = useVeo3TabStore()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedColor, setSelectedColor] = useState(ACCOUNT_COLORS[0])

  const resetForm = (): void => {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setDescription('')
    setSelectedColor(ACCOUNT_COLORS[0])
  }

  const handleAdd = (): void => {
    const usedColors = accounts.map((a) => a.color)
    const nextColor = ACCOUNT_COLORS.find((c) => !usedColors.includes(c)) || ACCOUNT_COLORS[0]
    setSelectedColor(nextColor)
    setShowForm(true)
    setEditingId(null)
    setName('')
    setDescription('')
  }

  const handleEdit = (id: string): void => {
    const account = accounts.find((a) => a.id === id)
    if (!account) return
    setEditingId(id)
    setName(account.name)
    setDescription(account.description)
    setSelectedColor(account.color)
    setShowForm(true)
  }

  const handleSave = (): void => {
    if (!name.trim()) return

    if (editingId) {
      updateAccount(editingId, { name: name.trim(), description: description.trim(), color: selectedColor })
    } else {
      addAccount(name.trim(), description.trim(), selectedColor)
    }
    resetForm()
  }

  const handleRemove = async (id: string): Promise<void> => {
    const account = accounts.find((a) => a.id === id)
    if (!account) return

    // Close any open tabs for this account
    const accountTabs = tabs.filter((t) => t.accountId === id)
    accountTabs.forEach((t) => closeTab(t.id))

    // Clear partition data
    try {
      await window.api.veo3ClearPartition(account.partition)
    } catch {
      // Continue even if clearing fails
    }

    removeAccount(id)
  }

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
          className="w-[480px] rounded-xl border border-border bg-surface shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-text">Gerenciar Contas VEO3</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Account List */}
          <div className="max-h-[320px] overflow-auto p-4">
            {accounts.length === 0 ? (
              <p className="py-8 text-center text-xs text-text-muted">
                Nenhuma conta cadastrada. Adicione sua primeira conta para comecar.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => {
                  const isOpen = tabs.some((t) => t.accountId === account.id)
                  const isDefault = account.id === defaultAccountId
                  return (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2.5"
                    >
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: account.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium text-text">
                            {account.name}
                          </span>
                          {isDefault && (
                            <Star className="h-3 w-3 shrink-0 fill-yellow-500 text-yellow-500" />
                          )}
                          {isOpen && (
                            <span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary-light">
                              em uso
                            </span>
                          )}
                        </div>
                        {account.description && (
                          <p className="truncate text-[10px] text-text-muted">
                            {account.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!isDefault && (
                          <button
                            onClick={() => setDefaultAccount(account.id)}
                            className="rounded p-1 text-text-muted transition-colors hover:bg-white/5 hover:text-yellow-500"
                            title="Definir como padrao"
                          >
                            <Star className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(account.id)}
                          className="rounded p-1 text-text-muted transition-colors hover:bg-white/5 hover:text-text"
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleRemove(account.id)}
                          className="rounded p-1 text-text-muted transition-colors hover:bg-white/5 hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-border"
              >
                <div className="space-y-3 p-4">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome da conta (ex: Canal Principal)"
                    maxLength={30}
                    className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descricao (opcional)"
                    maxLength={60}
                    className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">Cor:</span>
                    {ACCOUNT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className="rounded-full p-0.5"
                        style={{
                          outline: selectedColor === color ? `2px solid ${color}` : 'none',
                          outlineOffset: '2px'
                        }}
                      >
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={resetForm}
                      className="rounded-md px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!name.trim()}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
                    >
                      {editingId ? 'Salvar' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-[10px] text-text-muted">
              {accounts.length}/{MAX_ACCOUNTS} contas
            </span>
            <button
              onClick={handleAdd}
              disabled={accounts.length >= MAX_ACCOUNTS || showForm}
              className="flex items-center gap-1.5 rounded-md bg-white/5 px-3 py-1.5 text-xs text-text transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              Nova Conta
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
