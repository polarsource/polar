import BillingMigrationNotice from '../components/BillingMigrationNotice'
import {
  Button,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import { organization, product } from '../preview'
import type { schemas } from '../types'
import { formatCurrency, formatInterval } from '../utils/formatters'

export function SubscriptionRenewalReminder({
  email,
  organization,
  product,
  subscription,
  url,
  renewal_date,
  regular_amount,
  previous_billing_provider,
}: schemas['SubscriptionRenewalReminderProps']) {
  const promotionEnding =
    regular_amount !== null && regular_amount !== undefined
  return (
    <WrapperOrganization
      organization={organization}
      preview={
        promotionEnding
          ? `Your ${product.name} promotional price ends on ${renewal_date}`
          : `Your ${product.name} subscription renews on ${renewal_date}`
      }
    >
      {promotionEnding ? (
        <Intro headline="Your promotional price is ending">
          Your promotional price for{' '}
          <Text as="span" weight="medium">
            {product.name}
          </Text>{' '}
          ends on{' '}
          <Text as="span" weight="medium">
            {renewal_date}
          </Text>
          . Your subscription will then automatically renew{' '}
          {formatInterval(
            subscription.recurring_interval,
            subscription.recurring_interval_count,
          )}{' '}
          at{' '}
          <Text as="span" weight="medium">
            {formatCurrency(regular_amount, subscription.currency)}
          </Text>
          {subscription.tax_behavior === 'exclusive' &&
            ' (plus applicable taxes)'}
          .
        </Intro>
      ) : (
        <Intro headline="Upcoming subscription renewal">
          Your{' '}
          <Text as="span" weight="medium">
            {product.name}
          </Text>{' '}
          subscription will automatically renew on{' '}
          <Text as="span" weight="medium">
            {renewal_date}
          </Text>
          .
        </Intro>
      )}
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Text>
        You can change or cancel your subscription anytime from your customer
        portal. To avoid being charged, cancel before {renewal_date}.
        Cancellation takes effect at the end of your current billing period.
      </Text>
      <Button href={url}>Manage subscription</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionRenewalReminder.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'active',
    amount: 9000,
    currency: 'usd',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    current_period_end: '2026-04-15T10:30:00Z',
    trial_end: null,
    tax_behavior: 'exclusive',
  },
  renewal_date: 'April 15, 2026',
  regular_amount: 12000,
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionRenewalReminder
