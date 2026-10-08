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
import Benefits from '../components/Benefits'
import OrderSummary from '../components/OrderSummary'
import SubscriptionTermsNotice from '../components/SubscriptionTermsNotice'
import { order, organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionConfirmation({
  email,
  organization,
  product,
  order,
  subscription,
  url,
  previous_billing_provider,
  regular_amount,
}: schemas['SubscriptionConfirmationProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`You're now subscribed to ${product.name}`}
    >
      <Intro headline={`You're now subscribed to ${product.name}`}>
        Thank you for subscribing to{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>
        . Your invoice is attached.
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
      {product.benefits.length > 0 && <Benefits benefits={product.benefits} />}
      <Button href={url}>Access purchase</Button>
      <Divider />
      <OrderSummary order={order} />
      <SubscriptionTermsNotice
        productName={product.name}
        subscription={subscription}
        regularAmount={regular_amount}
        portalUrl={url}
      />
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionConfirmation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  order,
  subscription: {
    id: '12345',
    status: 'active',
    amount: 900,
    currency: 'usd',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    current_period_end: '2024-02-15T10:30:00Z',
    trial_end: null,
    tax_behavior: 'exclusive',
  },
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionConfirmation
