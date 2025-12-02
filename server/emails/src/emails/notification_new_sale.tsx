import { Hr, Img, Preview, Section, Text } from '@react-email/components'
import Button from '../components/Button'
import Footer from '../components/Footer'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
import type { schemas } from '../types'

export function NotificationNewSale({
  customer_email,
  customer_name,
  billing_address_city,
  billing_address_line1,
  formatted_price_amount,
  formatted_billing_reason,
  formatted_address_country,
  product_name,
  product_image_url,
  order_date,
  order_url,
}: schemas['MaintainerNewProductSaleNotificationPayload']) {
  const displayName = customer_name || customer_email || 'A customer'

  const formattedDate = order_date
    ? new Date(order_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      })
    : null

  const addressParts = [billing_address_line1, billing_address_city].filter(
    Boolean,
  )
  const formattedAddress =
    addressParts.length > 0 ? addressParts.join(', ') : null

  return (
    <Wrapper>
      <Preview>
        {displayName} placed an order for {product_name}
      </Preview>
      <PolarHeader />

      <Section className="pt-8">
        <Text className="m-0 text-lg text-gray-900">
          <strong>{displayName}</strong> placed an order{formattedDate ? ` on ${formattedDate}` : ''}!
        </Text>
      </Section>

      {order_url && (
        <Section className="mt-6 mb-8">
          <Button href={order_url}>View order</Button>
        </Section>
      )}

      <Hr className="my-6 border-gray-200" />

      <Section>
        <Text className="my-0 mb-2 text-base font-semibold text-gray-900">
          Order Summary
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
                  {product_name}
                </Text>
                <Text className="m-0 text-sm text-gray-500">
                  {formatted_price_amount}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Hr className="my-6 border-gray-200" />

      {formatted_billing_reason && (
        <Section>
          <Text className="m-0 text-sm font-semibold text-gray-900">
            Order Type
          </Text>
          <Text className="m-0 text-sm text-gray-600">
            {formatted_billing_reason}
          </Text>
        </Section>
      )}

      <Section className="mt-4 mb-6">
        <Text className="m-0 text-sm font-semibold text-gray-900">
          Customer
        </Text>
        {customer_name && (
          <Text className="m-0 text-sm text-gray-600">{customer_name}</Text>
        )}
        {customer_email && (
          <Text className="m-0 text-sm text-gray-600">{customer_email}</Text>
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

NotificationNewSale.PreviewProps = {
  customer_email: 'bob@ross.com',
  customer_name: 'Bob Ross',
  billing_address_country: 'US',
  billing_address_city: 'San Francisco',
  billing_address_line1: '123 Main St',
  formatted_price_amount: '$45.95',
  formatted_billing_reason: 'One-time purchase',
  formatted_address_country: 'United States',
  product_name: 'Beginners guide to painting',
  product_price_amount: 4595,
  product_image_url: 'https://placehold.co/64x64',
  order_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  order_date: '2024-11-05T20:41:00Z',
  order_url:
    'https://polar.sh/dashboard/acme-inc/sales/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  organization_name: 'Acme Inc.',
  organization_slug: 'acme-inc',
  billing_reason: 'purchase',
}

export default NotificationNewSale
