import React from 'react'
import { twMerge } from 'tailwind-merge'

export const Section = ({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) => {
  return (
    <div
      className={twMerge(
        'relative flex flex-col gap-12 py-12 2xl:flex-row 2xl:gap-32 2xl:py-16',
        className,
      )}
    >
      <SectionDescription title={title} description={description} icon={icon} />
      {children}
    </div>
  )
}

const SectionDescription = ({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
}) => {
  return (
    <div className="flex w-full max-w-96 flex-col gap-y-6">
      {icon}
      <div className="flex flex-col gap-y-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {description && (
          <p className="dark:text-polar-500 max-w-96 text-balance leading-snug text-gray-500">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
