import capcutIcon from '@/assets/capcut-icon.png'

interface CapCutIconProps {
  className?: string
}

export function CapCutIcon({ className = 'h-4 w-4' }: CapCutIconProps): React.JSX.Element {
  return <img src={capcutIcon} alt="CapCut" className={className} />
}
