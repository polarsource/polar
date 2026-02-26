import React from 'react'
import { twMerge } from 'tailwind-merge'

const variantClasses = {
  neutral: 'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  error:   'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  info:    'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
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
