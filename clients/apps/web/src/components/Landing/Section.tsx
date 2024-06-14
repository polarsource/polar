import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const Section = ({
  id,
  className,
  wrapperClassName,
  children,
}: PropsWithChildren<{
  id?: string
  className?: string
  wrapperClassName?: string
}>) => {
  return (
    <div
      id={id}
      className={twMerge(
        'relative flex w-full flex-col items-center justify-stretch',
        wrapperClassName,
      )}
    >
      <div
        className={twMerge(
          'flex w-full max-w-[100vw] flex-col px-6 py-32 md:max-w-7xl md:px-12',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
