import { twMerge } from 'tailwind-merge'
import { type CardProperties } from './types'

const BaseCard = (props: CardProperties) => {
  let className = 'w-full rounded-xl'
  if (props.border === true) {
    className = twMerge(className, 'border')
  }

  if (props.padding === true) {
    className = twMerge(className, 'p-6')
  }

  if (props.className) {
    className = twMerge(className, props.className)
  }

  return (
    <>
      <div className={className}>{props.children}</div>
    </>
  )
}
export default BaseCard
