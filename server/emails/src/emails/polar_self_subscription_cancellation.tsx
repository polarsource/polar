import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import type { schemas } from '../types'

export function PolarSelfSubscriptionCancellation({
  email,
  product_name,
  ends_at,
}: schemas['PolarSelfSubscriptionCancellationProps']) {
  const endDate = ends_at
    ? new Date(ends_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <WrapperPolar
      preview={`Your ${product_name} subscription has been canceled`}
    >
      <Intro headline="Your subscription has been canceled">
        Your{' '}
        <Text as="span" weight="medium">
          {product_name}
        </Text>{' '}
        subscription has been canceled.{' '}
        {endDate
          ? `You'll keep full access until ${endDate}.`
          : "You'll keep full access until the end of your current billing period."}
      </Intro>
      <Text>
        If you change your mind, you can resubscribe anytime from your billing
        settings.
      </Text>
      <Footer email={email} />
    </WrapperPolar>
  )
}

PolarSelfSubscriptionCancellation.PreviewProps = {
  email: 'john@example.com',
  product_name: 'Polar Pro',
  ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} satisfies schemas['PolarSelfSubscriptionCancellationProps']

export default PolarSelfSubscriptionCancellation
