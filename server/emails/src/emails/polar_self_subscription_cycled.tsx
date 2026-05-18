import { Preview, Text } from 'react-email'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function PolarSelfSubscriptionCycled({
  email,
  product_name,
  invoice_number,
}: schemas['PolarSelfSubscriptionCycledProps']) {
  return (
    <WrapperPolar>
      <Preview>Your {product_name} subscription renewed</Preview>
      <Intro headline="Your subscription renewed">
        Your <span className="font-medium">{product_name}</span> subscription
        has renewed. Invoice {invoice_number} is on its way.
      </Intro>
      <Text className="text-gray-500">
        This is a placeholder for the Polar-on-Polar subscription cycle email.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionCycled.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
  invoice_number: 'INV-0001',
}

export default PolarSelfSubscriptionCycled
