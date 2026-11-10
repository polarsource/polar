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

export function SubscriptionTrialPaymentMethodRequired({
  email,
  organization,
  product,
  url,
  trial_end_date,
  previous_billing_provider,
}: schemas['SubscriptionTrialPaymentMethodRequiredProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Add a payment method to keep your ${product.name} subscription`}
    >
      <Intro headline="Add a payment method">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        trial ends on{' '}
        <Text as="span" weight="medium">
          {trial_end_date}
        </Text>
        .
      </Intro>
      <Text>
        Add a payment method before then to continue on the paid plan.
        Otherwise, your subscription will end when the trial ends.
      </Text>
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Button href={url}>Add payment method</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionTrialPaymentMethodRequired.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'trialing',
  },
  trial_end_date: 'March 17, 2026',
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal',
}

export default SubscriptionTrialPaymentMethodRequired
