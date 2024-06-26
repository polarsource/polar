import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: {
  className?: string
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div
    className={twMerge(
      'dark:ring-polar-700 w-full rounded-xl bg-transparent p-8 shadow-sm ring-1 ring-gray-100 lg:rounded-3xl dark:bg-transparent dark:ring-1',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
