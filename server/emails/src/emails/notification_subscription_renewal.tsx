import { Footer, Intro, Text, WrapperPolar } from '../components/foundation'
import type { schemas } from '../types'

export function NotificationSubscriptionRenewal({
  customer_email,
  customer_name,
  formatted_price_amount,
  formatted_recurring_interval,
  product_name,
}: schemas['MaintainerSubscriptionRenewalNotificationPayload']) {
  const displayName = customer_name || customer_email || 'A customer'

  const formattedName =
    customer_name && customer_email ? (
      <>
        <Text as="span" weight="bold">
          {customer_name}
        </Text>{' '}
        ({customer_email})
      </>
    ) : (
      <Text as="span" weight="bold">
        {displayName}
      </Text>
    )

  return (
    <WrapperPolar preview={`${displayName} renewed ${product_name}`}>
      <Intro headline="A subscription has been renewed!">
        {formattedName} renewed{' '}
        <Text as="span" weight="bold">
          {product_name}
        </Text>{' '}
        for {formatted_price_amount} {formatted_recurring_interval}.
      </Intro>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationSubscriptionRenewal.PreviewProps = {
  customer_email: 'bob@ross.com',
  customer_name: 'Bob Ross',
  formatted_price_amount: '$10.00',
  formatted_recurring_interval: 'every month',
  product_name: 'Painting Pro',
  product_price_amount: 1000,
  recurring_interval: 'month',
  recurring_interval_count: 1,
}

export default NotificationSubscriptionRenewal
