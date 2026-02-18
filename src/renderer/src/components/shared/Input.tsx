import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-text-muted">{label}</label>}
      <input
        className={`w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none ${className}`}
        {...props}
      />
    </div>
  )
}
