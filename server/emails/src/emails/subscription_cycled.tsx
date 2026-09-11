import BillingMigrationNotice from '../components/BillingMigrationNotice'
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

export function SubscriptionCycled({
  email,
  organization,
  product,
  order,
  url,
  previous_billing_provider,
}: schemas['SubscriptionCycledProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription renewed`}
    >
      <Intro headline="Your subscription renewed">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription has just renewed. Your invoice is attached.
        {order.receipt_number && (
          <>
            {' '}
            You can find your receipt in the{' '}
            <EmailLink href={url}>Customer Portal</EmailLink>.
          </>
        )}
      </Intro>
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Button href={url}>Manage subscription</Button>
      <Divider />
      <OrderSummary order={order} />
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionCycled.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'active',
  },
  order,
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionCycled
