import { Hr, Img, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function NotificationNewSubscription({
  subscriber_name,
  subscriber_email,
  formatted_price_amount,
  formatted_address_country,
  tier_name,
  tier_price_amount,
  tier_price_recurring_interval,
  subscription_date,
  subscription_url,
  billing_address_city,
  billing_address_line1,
  product_image_url,
}: schemas['MaintainerNewPaidSubscriptionNotificationPayload']) {
  const displayName = subscriber_name || subscriber_email || 'A subscriber'

  const formattedDate = subscription_date
    ? new Date(subscription_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })
    : null

  const priceDisplay = tier_price_amount
    ? `${formatted_price_amount}/${tier_price_recurring_interval}`
    : 'free'

  const addressParts = [billing_address_line1, billing_address_city].filter(
    Boolean,
  )
  const formattedAddress =
    addressParts.length > 0 ? addressParts.join(', ') : null

  return (
    <Wrapper>
      <Preview>
        {displayName} subscribed to {tier_name}
      </Preview>
      <PolarHeader />

      <Section className="pt-8">
        <Text className="m-0 text-lg text-gray-900">
          <strong>{displayName}</strong> subscribed to <strong>{tier_name}</strong> for {tier_price_amount ? formatted_price_amount : 'free'}/{tier_price_recurring_interval}!
        </Text>
      </Section>

      {subscription_url && (
        <Section className="mt-6 mb-8">
          <Button href={subscription_url}>View subscription</Button>
        </Section>
      )}

      <Hr className="my-6 border-gray-200" />

      <Section>
        <Text className="my-0 mb-2 text-base font-semibold text-gray-900">
          Subscription Summary
        </Text>
        <table className="w-full">
          <tbody>
            <tr>
              {product_image_url && (
                <td className="w-[72px] pr-3 align-top">
                  <Img
                    src={product_image_url}
                    width={64}
                    height={64}
                    className="rounded-lg border border-gray-200"
                  />
                </td>
              )}
              <td className="align-middle">
                <Text className="m-0 text-sm font-medium text-gray-900">
                  {tier_name}
                </Text>
                <Text className="m-0 text-sm text-gray-500">{priceDisplay}</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Hr className="my-6 border-gray-200" />

      <Section className="mb-6">
        <Text className="m-0 text-sm font-semibold text-gray-900">Customer</Text>
        {subscriber_name && (
          <Text className="m-0 text-sm text-gray-600">{subscriber_name}</Text>
        )}
        {subscriber_email && (
          <Text className="m-0 text-sm text-gray-600">{subscriber_email}</Text>
        )}
        {formattedAddress && (
          <Text className="m-0 text-sm text-gray-600">{formattedAddress}</Text>
        )}
        {formatted_address_country && (
          <Text className="m-0 text-sm text-gray-600">
            {formatted_address_country}
          </Text>
        )}
      </Section>

      <Footer email={null} />
    </Wrapper>
  )
}

NotificationNewSubscription.PreviewProps = {
  subscriber_name: 'John Doe',
  subscriber_email: 'john@example.com',
  formatted_price_amount: '$12.95',
  formatted_address_country: 'United States',
  tier_name: 'Pro',
  tier_price_amount: 1295,
  tier_price_recurring_interval: 'month',
  tier_organization_name: 'Acme Inc.',
  subscription_id: 'sub_123456',
  subscription_date: '2024-11-05T20:41:00Z',
  subscription_url:
    'https://polar.sh/dashboard/acme-inc/sales/subscriptions/sub_123456',
  organization_slug: 'acme-inc',
  billing_address_country: 'US',
  billing_address_city: 'San Francisco',
  billing_address_line1: '123 Main St',
  product_image_url: 'https://placehold.co/64x64',
}

export default NotificationNewSubscription
