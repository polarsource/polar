import { Preview } from 'react-email'
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
        Thank you for subscribing to{' '}
        <span className="font-medium">{product_name}</span>. Your invoice is
        attached.
      </Intro>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionConfirmation.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
} satisfies schemas['PolarSelfSubscriptionConfirmationProps']

export default PolarSelfSubscriptionConfirmation
