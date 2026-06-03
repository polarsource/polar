import {
  Button,
  Divider,
  FooterCustomer,
  WrapperOrganization,
} from '../components/layout'
import OrderSummary from '../components/OrderSummary'
import { EmailLink, Intro, Text } from '../components/text'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionFinalInvoice({
  email,
  organization,
  product,
  order,
  url,
}: schemas['SubscriptionFinalInvoiceProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} final invoice`}
    >
      <Intro headline="Your final invoice">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription has ended. Your final invoice is attached.
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

SubscriptionFinalInvoice.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'canceled',
  },
  order,
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionFinalInvoice
