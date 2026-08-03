import {
  Button,
  EmailLink,
  Footer,
  Text,
  WrapperPolar,
} from '../components/foundation'
import SaleSummary from '../components/SaleSummary'
import type { schemas } from '../types'

export function NotificationSubscriptionRenewal({
  customer_email,
  customer_name,
  formatted_price_amount,
  formatted_recurring_interval,
  product_name,
  product_image_url,
  order_date,
  order_url,
  subscription_url,
}: schemas['MaintainerSubscriptionRenewalNotificationPayload']) {
  const displayName = customer_name || customer_email || 'A customer'

  const formattedDate = order_date
    ? new Date(order_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <WrapperPolar
      preview={`${displayName} renewed their subscription to ${product_name}`}
    >
      <Text variant="lead">
        <Text as="span" weight="bold">
          {displayName}
        </Text>{' '}
        renewed their subscription to {product_name}
        {formattedDate ? ` on ${formattedDate}` : ''}.
      </Text>
      {subscription_url && (
        <Button href={subscription_url}>View subscription</Button>
      )}
      <SaleSummary
        product_name={product_name}
        product_image_url={product_image_url}
        formatted_price_amount={formatted_price_amount}
        formatted_billing_reason={`Subscription renewal — renews ${formatted_recurring_interval}`}
        customer_name={customer_name}
        customer_email={customer_email}
      />
      {order_url && (
        <Text variant="footnote">
          <EmailLink href={order_url}>View the order</EmailLink> for the full
          payment breakdown.
        </Text>
      )}
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
  product_image_url: 'https://placehold.co/64x64',
  order_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  order_date: '2024-11-05T20:41:00Z',
  order_url:
    'https://polar.sh/dashboard/acme-inc/sales/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  organization_name: 'Acme Inc.',
  organization_slug: 'acme-inc',
  subscription_id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  subscription_url:
    'https://polar.sh/dashboard/acme-inc/sales/subscriptions/b2c3d4e5-f6a7-8901-bcde-f23456789012',
  recurring_interval: 'month',
  recurring_interval_count: 1,
}

export default NotificationSubscriptionRenewal
