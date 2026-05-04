import { Hr, Link, Preview, Section } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import OrderSummary from '../components/OrderSummary'
import WrapperOrganization from '../components/WrapperOrganization'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionFinalInvoice({
  email,
  organization,
  product,
  subscription,
  order,
  url,
}: schemas['SubscriptionFinalInvoiceProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your {product.name} final invoice</Preview>
      <Intro headline="Your final invoice">
        Your <span className="font-medium">{product.name}</span> subscription
        has ended. Your final invoice is attached.
        {order.receipt_number && (
          <>
            {' '}
            You can find your receipt in the{' '}
            <Link href={url} className="text-blue-600 underline">
              Customer Portal
            </Link>
            .
          </>
        )}
      </Intro>
      <Section className="my-8 text-center">
        <Button href={url}>Manage subscription</Button>
      </Section>
      <Hr />
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
