import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: PropsWithChildren<{ className?: string }>) => (
  <div
    className={twMerge(
      'dark:bg-polar-900 lg:rounded-4xl dark:border-polar-700 w-full rounded-xl border border-gray-200 bg-gray-50 p-8',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
