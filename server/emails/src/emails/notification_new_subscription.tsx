import { Footer, WrapperPolar } from '../components/layout'
import { Intro, Text } from '../components/text'
import type { schemas } from '../types'

export function NotificationNewSubscription({
  subscriber_name,
  subscriber_email,
  formatted_price_with_interval,
  formatted_price_amount,
  tier_name,
  tier_price_amount,
  tier_price_recurring_interval,
}: schemas['MaintainerNewPaidSubscriptionNotificationPayload']) {
  const formattedName = subscriber_email ? (
    <>
      <Text as="span" weight="bold">
        {subscriber_name}
      </Text>{' '}
      ({subscriber_email})
    </>
  ) : (
    <Text as="span" weight="bold">
      {subscriber_name}
    </Text>
  )

  const priceDisplay =
    formatted_price_with_interval ??
    (tier_price_amount
      ? `${formatted_price_amount}/${tier_price_recurring_interval}`
      : 'free')

  return (
    <WrapperPolar preview={`New ${tier_name} subscriber`}>
      <Intro headline="Congratulations!">
        {formattedName} is now subscribing to{' '}
        <Text as="span" weight="bold">
          {tier_name}
        </Text>{' '}
        for {priceDisplay}.
      </Intro>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationNewSubscription.PreviewProps = {
  subscriber_name: 'John Doe',
  subscriber_email: 'john.doe@acme.com',
  formatted_price_amount: '$12.95',
  formatted_price_with_interval: '$12.95/month',
  tier_name: 'Pro',
  tier_price_amount: 1295,
  tier_price_recurring_interval: 'month',
  tier_price_recurring_interval_count: 1,
  tier_organization_name: 'Acme Inc.',
}

export default NotificationNewSubscription
