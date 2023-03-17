import { classNames } from '../../../utils/dom'
import BaseCard from './BaseCard'
import { type CardProperties } from './types'

const WhiteCard = (props: CardProperties) => {
  const className = classNames('bg-white drop-shadow-lg', props.className || '')

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
