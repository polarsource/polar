import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
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
    <ShadowBoxOnMd className="relative flex flex-col gap-12 md:flex-row md:gap-32 md:p-12">
      <SectionDescription title={title} description={description} />
      {children}
    </ShadowBoxOnMd>
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
    <div className="flex w-full flex-shrink-0 flex-col gap-y-2 md:w-1/3">
      <h2 className="text-lg font-medium">{title}</h2>
      {description && (
        <p className="dark:text-polar-500 text-balance text-gray-500">
          {description}
        </p>
      )}
    </div>
  )
}
