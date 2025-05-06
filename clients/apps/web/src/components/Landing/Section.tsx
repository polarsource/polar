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
      className={twMerge('relative flex flex-col', wrapperClassName)}
    >
      <div
        className={twMerge('flex flex-col py-12 md:px-0 md:py-16', className)}
      >
        {children}
      </div>
    </div>
  )
}
