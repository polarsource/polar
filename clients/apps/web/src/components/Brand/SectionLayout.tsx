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
        'flex min-h-screen w-screen flex-col justify-between gap-y-12 p-8 md:gap-y-24 md:p-16',
        className,
      )}
    >
      {label ? (
        <span className="text-4xl tracking-tighter md:text-7xl dark:font-light">
          {label}
        </span>
      ) : (
        <div />
      )}
      <div className={twMerge('flex flex-col')}>{children}</div>
      {footer ?? <div />}
    </div>
  )
}
