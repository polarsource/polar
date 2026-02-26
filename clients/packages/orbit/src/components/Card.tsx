import React, { type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button, type ButtonProps } from './Button'

export function Card({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-polar-700 dark:bg-polar-800',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export function CardContent({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return <div className={twMerge('flex-1', className)}>{children}</div>
}

export function CardFooter({
  children,
  className,
  actions,
}: {
  children?: ReactNode
  className?: string
  actions?: ButtonProps[]
}) {
  return (
    <div
      className={twMerge(actions ? 'pt-4' : undefined, className)}
    >
      {children}
      {actions && (
        <div className="flex gap-2">
          {actions.map((props, i) => (
            <Button key={i} {...props} />
          ))}
        </div>
      )}
    </div>
  )
}
