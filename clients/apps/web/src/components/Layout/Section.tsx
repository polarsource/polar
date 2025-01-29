import React from 'react'
import { twMerge } from 'tailwind-merge'

export const Section = ({
  title,
  description,
  children,
  className,
  cta,
  compact,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  cta?: React.ReactNode
  compact?: boolean
}) => {
  return (
    <div
      className={twMerge(
        'relative flex flex-col',
        compact ? 'gap-6 p-8' : 'gap-12 p-12',
        className,
      )}
    >
      <SectionDescription title={title} description={description} cta={cta} />
      {children}
    </div>
  )
}

const SectionDescription = ({
  title,
  description,
  cta,
}: {
  title: string
  description?: string
  cta?: React.ReactNode
}) => {
  return (
    <div className="flex w-full flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {description && (
          <p className="dark:text-polar-500 leading-snug text-gray-500">
            {description}
          </p>
        )}
        {cta && <div className="flex flex-row gap-x-2">{cta}</div>}
      </div>
    </div>
  )
}
