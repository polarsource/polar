import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import Footer from '../components/layout/Footer'
import SaleSummary from '../components/SaleSummary'
import Text from '../components/text/Text'
import WrapperPolar from '../components/layout/WrapperPolar'
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
    <WrapperPolar
      preview={`${displayName} placed an order for ${product_name}`}
    >
      <Text variant="lead">
        <Text as="span" weight="bold">
          {displayName}
        </Text>{' '}
        placed an order
        {formattedDate ? ` on ${formattedDate}` : ''}!
      </Text>

      {order_url && (
        <CTASection>
          <Button href={order_url}>View order</Button>
        </CTASection>
      )}

      <SaleSummary
        product_name={product_name}
        product_image_url={product_image_url}
        formatted_price_amount={formatted_price_amount}
        formatted_billing_reason={formatted_billing_reason}
        customer_name={customer_name}
        customer_email={customer_email}
        formatted_address={formattedAddress}
        formatted_address_country={formatted_address_country}
      />

      <Footer email={null} />
    </WrapperPolar>
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
