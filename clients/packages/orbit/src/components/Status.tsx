import React from 'react'
import { twMerge } from 'tailwind-merge'

const variantClasses = {
  neutral:  'bg-(--status-neutral-background) text-(--status-neutral-foreground)',
  success:  'bg-(--status-success-background) text-(--status-success-foreground)',
  warning:  'bg-(--status-warning-background) text-(--status-warning-foreground)',
  error:    'bg-(--status-error-background) text-(--status-error-foreground)',
  info:     'bg-(--status-info-background) text-(--status-info-foreground)',
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
