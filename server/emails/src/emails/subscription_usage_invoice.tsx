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
  product,
  subscription: {
    id: '12345',
    status: 'active',
  },
  order,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUsageInvoice
