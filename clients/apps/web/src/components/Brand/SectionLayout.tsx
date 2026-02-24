import React from 'react'
import { twMerge } from 'tailwind-merge'
import { Headline } from '@polar-sh/orbit'

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
      {label ? <Headline as="h1" animate text={label} /> : <div />}
      <div className={twMerge('flex flex-col')}>{children}</div>
      {footer ?? <div />}
    </div>
  )
}
