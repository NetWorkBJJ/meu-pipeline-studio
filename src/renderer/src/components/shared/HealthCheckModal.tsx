import { useEffect, useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface CheckItem {
  label: string
  ok: boolean | null
  error?: string
  hint?: string
}

interface HealthCheckModalProps {
  onDismiss: () => void
}

const APP_VERSION = '0.1.0'
const STORAGE_KEY = 'healthCheckDismissed'

function shouldShowHealthCheck(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== APP_VERSION
  } catch {
    return true
  }
}

function markHealthCheckDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, APP_VERSION)
  } catch {
    // silent
  }
}

export function HealthCheckModal({ onDismiss }: HealthCheckModalProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checks, setChecks] = useState<CheckItem[]>([
    { label: 'Python bridge', ok: null },
    { label: 'CapCut Desktop', ok: null },
    { label: 'Projetos CapCut', ok: null }
  ])
  const hasFailure = useRef(false)

  const close = useCallback(() => {
    setVisible(false)
    markHealthCheckDismissed()
    onDismiss()
  }, [onDismiss])

  useEffect(() => {
    if (!shouldShowHealthCheck()) {
      onDismiss()
      return
    }

    setVisible(true)

    const run = async (): Promise<void> => {
      try {
        const result = await window.api.systemHealthCheck()

        const updated: CheckItem[] = [
          {
            label: 'Python bridge',
            ok: result.python.ok,
            error: result.python.error,
            hint: result.python.ok ? 'Operacional' : 'Nao respondeu. Reinicie o app.'
          },
          {
            label: 'CapCut Desktop',
            ok: result.capcut.ok,
            hint: result.capcut.ok
              ? 'Instalado'
              : 'Nao encontrado. Instale o CapCut Desktop antes de usar o pipeline.'
          },
          {
            label: 'Projetos CapCut',
            ok: result.capcutProjects.ok,
            hint: result.capcutProjects.ok
              ? 'Diretorio encontrado'
              : 'Diretorio de projetos nao encontrado. Abra o CapCut pelo menos uma vez.'
          }
        ]

        hasFailure.current = updated.some((c) => !c.ok)
        setChecks(updated)
        setLoading(false)

        if (!hasFailure.current) {
          setTimeout(close, 1500)
        }
      } catch {
        setChecks([
          { label: 'Python bridge', ok: false, hint: 'Erro ao verificar' },
          { label: 'CapCut Desktop', ok: false, hint: 'Erro ao verificar' },
          { label: 'Projetos CapCut', ok: false, hint: 'Erro ao verificar' }
        ])
        hasFailure.current = true
        setLoading(false)
      }
    }

    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm rounded-xl border border-border bg-surface-2 p-6 shadow-popover"
          >
            <div className="mb-5 flex items-center gap-2.5">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-text">Verificacao do Sistema</h3>
            </div>

            <div className="space-y-3">
              {checks.map((check) => (
                <div key={check.label} className="flex items-start gap-2.5">
                  {loading || check.ok === null ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-text-muted" />
                  ) : check.ok ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text">{check.label}</p>
                    {check.hint && (
                      <p
                        className={`text-xs ${check.ok ? 'text-text-muted' : 'text-red-400/80'}`}
                      >
                        {check.hint}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!loading && hasFailure.current && (
              <button
                type="button"
                onClick={close}
                className="mt-5 w-full rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Continuar mesmo assim
              </button>
            )}

            {!loading && !hasFailure.current && (
              <p className="mt-4 text-center text-xs text-text-muted">
                Tudo certo. Iniciando...
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
