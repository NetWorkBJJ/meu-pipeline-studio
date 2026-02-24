interface BadgeProps {
  variant?: 'default' | 'success' | 'error' | 'warning'
  children: React.ReactNode
}

export function Badge({ variant = 'default', children }: BadgeProps): React.JSX.Element {
  const variants = {
    default: 'bg-elevated text-text-muted',
    success: 'bg-success/20 text-success',
    error: 'bg-error/20 text-error',
    warning: 'bg-warning/20 text-warning'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  )
}
