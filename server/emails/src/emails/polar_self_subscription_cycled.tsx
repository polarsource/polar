/* eslint-disable no-restricted-imports, email-ds/no-classname */
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
      <Intro headline={`${product_name} renewed`}>
        Your <span className="font-medium">{product_name}</span> subscription
        renewed for another cycle. The latest invoice is attached.
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
