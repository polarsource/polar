import {
  Button,
  Divider,
  EmailLink,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import OrderSummary from '../components/OrderSummary'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionUsageInvoice({
  email,
  organization,
  product,
  order,
  url,
}: schemas['SubscriptionUsageInvoiceProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} usage invoice`}
    >
      <Intro headline="Your usage invoice">
        Here is the invoice for your usage on your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription. Your invoice is attached.
        {order.receipt_number && (
          <>
            {' '}
            You can find your receipt in the{' '}
            <EmailLink href={url}>Customer Portal</EmailLink>.
          </>
        )}
      </Intro>
      <Button href={url}>Manage subscription</Button>
      <Divider />
      <OrderSummary order={order} />
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionUsageInvoice.PreviewProps = {
  email: 'john@example.com',
  organization,
  product: { ...product, name: 'API Pro' },
  subscription: {
    id: '12345',
    status: 'active',
  },
  order: {
    ...order,
    description: 'API Pro',
    billing_reason: 'subscription_meter_cycle',
    subscription_id: '12345',
    subtotal_amount: 1050,
    discount_amount: 0,
    net_amount: 1050,
    tax_amount: 0,
    total_amount: 1050,
    applied_balance_amount: 0,
    due_amount: 1050,
    items: [
      {
        id: 'item-1',
        label: 'API requests — (42 consumed units) × $0.25',
        amount: 1050,
        proration: false,
        product_price_id: 'price123',
      },
    ],
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUsageInvoice
