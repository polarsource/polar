import React from 'react'
import { twMerge } from 'tailwind-merge'

const variantClasses = {
  neutral: 'bg-(--STATUS-NEUTRAL-BACKGROUND) text-(--STATUS-NEUTRAL-FOREGROUND)',
  success: 'bg-(--STATUS-SUCCESS-BACKGROUND) text-(--STATUS-SUCCESS-FOREGROUND)',
  warning: 'bg-(--STATUS-WARNING-BACKGROUND) text-(--STATUS-WARNING-FOREGROUND)',
  error: 'bg-(--STATUS-ERROR-BACKGROUND) text-(--STATUS-ERROR-FOREGROUND)',
  info: 'bg-(--STATUS-INFO-BACKGROUND) text-(--STATUS-INFO-FOREGROUND)',
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
