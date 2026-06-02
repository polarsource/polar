/* eslint-disable no-restricted-imports, email-ds/no-classname */
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
      <Preview>We're happy to have you selling on Polar!</Preview>
      <Intro headline="Thanks for choosing Polar!">
        You're now subscribed to{' '}
        <span className="font-medium">{product_name}</span>. Your invoice is
        attached for your records.
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
