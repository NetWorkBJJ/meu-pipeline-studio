import { useEffect } from 'react'
import { useUIStore } from '../../stores/useUIStore'

export function ToastContainer(): React.JSX.Element {
  const { toasts, removeToast } = useUIStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onDismiss={removeToast}
        />
      ))}
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
    <div className={`rounded-md border px-4 py-2 text-sm shadow-lg ${colors[type]}`}>{message}</div>
  )
}
