import { classNames } from '../../../utils/dom'
import BaseCard from './BaseCard'
import { type CardProperties } from './types'

const WhiteCard = (props: CardProperties) => {
  const className = classNames(
    'bg-white shadow dark:bg-polar-800 dark:ring-1 dark:ring-polar-700',
    props.className || '',
  )

  const updatedProps = {
    ...props,
    className,
    border: false,
  }

  return (
    <>
      <BaseCard {...updatedProps} />
    </>
  )
}
export default WhiteCard
