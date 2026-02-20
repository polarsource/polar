import { twMerge } from 'tailwind-merge'

const variantClasses = {
  neutral:
    'bg-neutral-100 text-neutral-500 dark:bg-polar-800 dark:text-polar-500',
  success:
    'bg-emerald-100 text-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-500',
  warning:
    'bg-amber-100 text-amber-500 dark:bg-amber-950/50 dark:text-amber-500',
  error: 'bg-red-100 text-red-500 dark:bg-red-950/50 dark:text-red-500',
  info: 'bg-blue-100 text-blue-500 dark:bg-blue-950/50 dark:text-blue-500',
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1 text-sm',
}

export type StatusVariant = keyof typeof variantClasses
export type StatusSize = keyof typeof sizeClasses

export type StatusProps = {
  status: string
  variant?: StatusVariant
  size?: StatusSize
  className?: string
}

export function Status({
  status,
  variant = 'neutral',
  size = 'md',
  className,
}: StatusProps) {
  return (
    <span
      className={twMerge(
        'tracking-snug inline-flex items-center justify-center rounded-md font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {status}
    </span>
  )
}
