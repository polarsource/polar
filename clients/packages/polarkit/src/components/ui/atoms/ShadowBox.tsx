import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: PropsWithChildren<{ className?: string }>) => (
  <div
    className={twMerge(
      'dark:bg-polar-800 dark:border-polar-700 w-full border border-transparent bg-gray-50 p-8',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
