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
        'relative flex w-full flex-col items-center justify-stretch dark:bg-black',
        wrapperClassName,
      )}
    >
      <div
        className={twMerge(
          'flex w-full max-w-[100vw] flex-col px-4 py-16 md:max-w-7xl md:px-12 md:py-32',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
