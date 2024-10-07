import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: PropsWithChildren<{ className?: string }>) => (
  <div
    className={twMerge(
      'dark:bg-polar-900 lg:rounded-4xl dark:border-polar-700 w-full rounded-xl border border-gray-100 bg-white p-8',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
