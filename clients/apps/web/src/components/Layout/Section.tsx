import React from 'react'

export const Section = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => {
  return (
    <div className="relative flex flex-col gap-12 py-12 md:flex-row md:gap-32 md:py-16">
      <SectionDescription title={title} description={description} />
      {children}
    </div>
  )
}

const SectionDescription = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => {
  return (
    <div className="flex w-full flex-shrink-0 flex-col gap-y-2 md:w-2/5">
      <h2 className="text-lg font-medium">{title}</h2>
      {description && (
        <p className="dark:text-polar-500 max-w-96 text-balance leading-snug text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
