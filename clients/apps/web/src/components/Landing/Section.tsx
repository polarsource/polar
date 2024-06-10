import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const Section = ({
  className,
  wrapperClassName,
  children,
}: PropsWithChildren<{ className?: string; wrapperClassName?: string }>) => {
  return (
    <div
      className={twMerge(
        'flex h-fit w-full max-w-[100vw] flex-row justify-stretch md:max-w-7xl',
        wrapperClassName,
      )}
    >
      <div
        className={twMerge(
          'flex w-full flex-grow flex-col px-6 md:px-12',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
