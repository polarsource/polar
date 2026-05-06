import { Box } from '@polar-sh/orbit/Box'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export type SectionProps = PropsWithChildren<{
  id?: string
  className?: string
  wrapperClassName?: string
  border?: boolean
}>

export const Section = ({
  id,
  className,
  wrapperClassName,
  children,
  border,
}: SectionProps) => {
  return (
    <Box
      id={id}
      className={twMerge(
        'relative flex flex-col md:items-center',
        border ? 'dark:border-polar-700 border-b border-gray-200' : '',
        wrapperClassName,
      )}
    >
      <Box
        className={twMerge(
          'flex w-full flex-col py-12  md:px-0 md:py-16 gap-y-24 md:max-w-7xl',
          className,
        )}
      >
        {children}
      </Box>
    </Box>
  )
}
