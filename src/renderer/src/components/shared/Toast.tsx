import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useUIStore } from '../../stores/useUIStore'

export function ToastContainer(): React.JSX.Element {
  const { toasts, removeToast } = useUIStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onDismiss={removeToast}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ToastItemProps {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  onDismiss: (id: string) => void
}

function ToastItem({ id, type, message, onDismiss }: ToastItemProps): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 4000)
    return () => clearTimeout(timer)
  }, [id, onDismiss])

  const colors = {
    success: 'border-success/30 bg-success/10 text-success',
    error: 'border-error/30 bg-error/10 text-error',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-primary/30 bg-primary/10 text-primary'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={`rounded-lg border px-4 py-2.5 text-sm shadow-popover backdrop-blur-sm ${colors[type]}`}
    >
      {message}
    </motion.div>
  )
}
