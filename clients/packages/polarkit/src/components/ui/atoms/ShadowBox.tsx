import { twMerge } from 'tailwind-merge'
import ShadowBoxOnMd from './ShadowBoxOnMd'

const ShadowBox = (props: {
  className?: string
  children: React.ReactElement | React.ReactElement[]
}) => (
  <div
    className={twMerge(
      'dark:bg-polar-800 w-full rounded-xl bg-transparent bg-white p-8 lg:rounded-3xl',
      props.className,
    )}
  >
    {props.children}
  </div>
)

export default ShadowBox

export { ShadowBoxOnMd }
