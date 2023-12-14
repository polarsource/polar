import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

const ShadowBoxOnMd = (
  props: PropsWithChildren<{
    className?: string
  }>,
) => (
  <div
    className={twMerge(
      'md:dark:bg-polar-900 md:dark:ring-polar-800 w-full md:rounded-xl md:bg-white md:p-8 md:shadow-lg md:dark:ring-1 lg:rounded-3xl',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBoxOnMd
