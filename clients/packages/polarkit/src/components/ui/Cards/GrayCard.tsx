import BaseCard from './BaseCard'
import { type CardProperties } from './types'

const GrayCard = (props: CardProperties) => {
  return (
    <>
      <BaseCard {...props}>{props.children}</BaseCard>
    </>
  )
}
export default GrayCard
