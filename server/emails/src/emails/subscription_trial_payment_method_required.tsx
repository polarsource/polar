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

const getCopy = (
  paymentMethodRequired: boolean,
  billingAddressRequired: boolean,
) => {
  if (!billingAddressRequired) {
    return {
      headline: 'Add a payment method',
      action: 'Add a payment method',
      button: 'Add payment method',
    }
  }
  if (!paymentMethodRequired) {
    return {
      headline: 'Complete your billing address',
      action: 'Complete your billing address',
      button: 'Update billing address',
    }
  }
  return {
    headline: 'Add your billing details',
    action: 'Add a payment method and complete your billing address',
    button: 'Add billing details',
  }
}

export function SubscriptionTrialPaymentMethodRequired({
  email,
  organization,
  product,
  url,
  trial_end_date,
  previous_billing_provider,
  payment_method_required,
  billing_address_required,
}: schemas['SubscriptionTrialPaymentMethodRequiredProps']) {
  const copy = getCopy(payment_method_required, billing_address_required)
  return (
    <WrapperOrganization
      organization={organization}
      preview={`${copy.action} to keep your ${product.name} subscription`}
    >
      <Intro headline={copy.headline}>
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
        {copy.action} before then to continue on the paid plan. Otherwise, your
        subscription will end when the trial ends.
      </Text>
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Button href={url}>{copy.button}</Button>
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
  payment_method_required: true,
  billing_address_required: false,
  url: 'https://polar.sh/acme-inc/portal',
}

export default SubscriptionTrialPaymentMethodRequired
