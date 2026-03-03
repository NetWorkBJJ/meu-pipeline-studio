import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, RefreshCw, X } from 'lucide-react'

interface UpdateStatus {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
  version?: string
  percent?: number
  error?: string
}

export function UpdateBanner(): React.JSX.Element | null {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const cleanup = window.api.onUpdaterStatus((data) => {
      setUpdate(data as UpdateStatus)
      setDismissed(false)
    })
    return cleanup
  }, [])

  const handleDownload = useCallback(async () => {
    await window.api.updaterDownload()
  }, [])

  const handleInstall = useCallback(() => {
    window.api.updaterInstall()
  }, [])

  const visible = update && !dismissed && update.status !== 'checking' && update.status !== 'up-to-date'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex items-center justify-between bg-primary/90 px-4 py-1.5 text-[12px] text-white">
            <div className="flex items-center gap-2">
              {update.status === 'available' && (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Nova versao disponivel: v{update.version}</span>
                </>
              )}
              {update.status === 'downloading' && (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Baixando atualizacao... {update.percent ?? 0}%</span>
                </>
              )}
              {update.status === 'downloaded' && (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Atualizacao pronta para instalar (v{update.version})</span>
                </>
              )}
              {update.status === 'error' && (
                <span>
                  Erro ao verificar atualizacao:{' '}
                  {update.error && update.error.length > 120
                    ? update.error.slice(0, 120) + '...'
                    : update.error}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {update.status === 'available' && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="rounded bg-white/20 px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-white/30"
                >
                  Baixar
                </button>
              )}
              {update.status === 'downloaded' && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="rounded bg-white/20 px-2.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-white/30"
                >
                  Reiniciar e Instalar
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded p-0.5 transition-colors hover:bg-white/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
