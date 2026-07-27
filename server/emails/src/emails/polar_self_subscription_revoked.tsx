import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import type { schemas } from '../types'

export function PolarSelfSubscriptionRevoked({
  email,
  product_name,
}: schemas['PolarSelfSubscriptionRevokedProps']) {
  return (
    <WrapperPolar preview={`Your ${product_name} subscription has ended`}>
      <Intro headline={`Your ${product_name} subscription has ended`}>
        Your{' '}
        <Text as="span" weight="medium">
          {product_name}
        </Text>{' '}
        subscription has ended, and the associated benefits are no longer
        active.
      </Intro>
      <Text>
        You can resubscribe anytime from your billing settings. If this
        wasn&rsquo;t expected, please get in touch and we&rsquo;ll help sort it
        out.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionRevoked.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
} satisfies schemas['PolarSelfSubscriptionRevokedProps']

export default PolarSelfSubscriptionRevoked
