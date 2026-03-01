import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export type SectionProps = PropsWithChildren<{
  id?: string
  className?: string
  wrapperClassName?: string
}>

export const Section = ({
  id,
  className,
  wrapperClassName,
  children,
}: SectionProps) => {
  return (
    <div
      id={id}
      className={twMerge(
        'dark:border-polar-700 relative flex flex-col border-b border-gray-200 md:items-center',
        wrapperClassName,
      )}
    >
      <div
        className={twMerge(
          'flex w-full flex-col py-12 md:max-w-3xl md:px-0 md:py-16 xl:max-w-7xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
