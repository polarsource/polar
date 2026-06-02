import { Footer, WrapperPolar } from '../components/layout'
import { Intro, Text } from '../components/text'
import type { schemas } from '../types'

export function PolarSelfSubscriptionConfirmation({
  email,
  product_name,
}: schemas['PolarSelfSubscriptionConfirmationProps']) {
  return (
    <WrapperPolar preview="We're happy to have you selling on Polar!">
      <Intro headline="Thanks for choosing Polar!">
        You're now subscribed to{' '}
        <Text as="span" weight="medium">
          {product_name}
        </Text>
        . Your invoice is attached for your records.
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
