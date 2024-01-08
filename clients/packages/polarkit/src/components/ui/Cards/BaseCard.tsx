import { twMerge } from 'tailwind-merge'
import { type CardProperties } from './types'

const BaseCard = (props: CardProperties) => (
  <>
    <div
      className={twMerge(
        'w-full rounded-xl',
        props.border ? 'border' : '',
        props.padding ? 'p-6' : '',
        props.className,
      )}
    >
      {props.children}
    </div>
  </>
)

export default BaseCard
