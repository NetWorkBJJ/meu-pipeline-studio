import { TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function TextArea({ label, className = '', ...props }: TextAreaProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-text-muted">{label}</label>}
      <textarea
        className={`w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/40 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none ${className}`}
        {...props}
      />
    </div>
  )
}
