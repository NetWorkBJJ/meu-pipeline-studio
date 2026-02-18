interface ProgressBarProps {
  value: number
  max?: number
  label?: string
}

export function ProgressBar({ value, max = 100, label }: ProgressBarProps): React.JSX.Element {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className="w-full">
      {label && <div className="mb-1 text-xs text-text-muted">{label}</div>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
