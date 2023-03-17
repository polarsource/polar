import { classNames } from '../../../utils/dom'
import { type CardProperties } from './types'

const BaseCard = (props: CardProperties) => {
  let className = 'w-full rounded-xl'
  if (props.border !== false) {
    className = classNames(className, 'border')
  }

  if (props.padding !== false) {
    className = classNames(className, 'p-6')
  }

  if (props.className) {
    className = classNames(className, props.className)
  }

  return (
    <>
      <div className={className}>{props.children}</div>
    </>
  )
}
export default BaseCard
