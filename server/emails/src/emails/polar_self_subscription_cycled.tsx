import { Preview } from 'react-email'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function PolarSelfSubscriptionCycled({
  email,
  product_name,
}: schemas['PolarSelfSubscriptionCycledProps']) {
  return (
    <WrapperPolar>
      <Preview>Your {product_name} subscription renewed</Preview>
      <Intro headline="Your subscription renewed">
        Your <span className="font-medium">{product_name}</span> subscription
        has just renewed. Your invoice is attached.
      </Intro>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionCycled.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
} satisfies schemas['PolarSelfSubscriptionCycledProps']

export default PolarSelfSubscriptionCycled
