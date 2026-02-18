import { TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function TextArea({ label, className = '', ...props }: TextAreaProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-text-muted">{label}</label>}
      <textarea
        className={`w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:border-primary focus:outline-none resize-none ${className}`}
        {...props}
      />
    </div>
  )
}
