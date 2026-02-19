import { ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gradient'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  const base =
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-hover shadow-surface active:scale-[0.98]',
    secondary:
      'border border-border bg-surface text-text hover:bg-surface-hover active:scale-[0.98]',
    ghost: 'text-text-muted hover:bg-surface-hover hover:text-text active:scale-[0.98]',
    gradient: 'gradient-primary text-white shadow-glow-sm hover:shadow-glow active:scale-[0.98]'
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm'
  }

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
    >
      {children}
    </motion.button>
  )
}
