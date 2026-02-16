import React from 'react'
import { twMerge } from 'tailwind-merge'

export function SectionLayout({
  label,
  children,
  footer,
  className,
}: {
  label?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'flex h-full w-full flex-col justify-between gap-y-16 p-16',
      )}
    >
      {label ? (
        <span className="dark:text-polar-500 text-3xl text-neutral-500">
          {label}
        </span>
      ) : (
        <div />
      )}
      <div className={twMerge('flex flex-col', className)}>{children}</div>
      {footer ?? <div />}
    </div>
  )
}
