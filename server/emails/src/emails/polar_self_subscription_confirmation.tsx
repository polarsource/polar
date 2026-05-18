import { Preview, Text } from 'react-email'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function PolarSelfSubscriptionConfirmation({
  email,
  product_name,
}: schemas['PolarSelfSubscriptionConfirmationProps']) {
  return (
    <WrapperPolar>
      <Preview>Welcome to {product_name}</Preview>
      <Intro headline={`Welcome to ${product_name}`}>
        Thanks for subscribing to{' '}
        <span className="font-medium">{product_name}</span>. We're glad to have
        you on Polar — built on Polar.
      </Intro>
      <Text className="text-gray-500">
        This is a placeholder for the Polar-on-Polar new subscriber email.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionConfirmation.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
}

export default PolarSelfSubscriptionConfirmation
