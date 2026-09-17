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

export function SubscriptionResumed({
  email,
  organization,
  product,
  url,
  previous_billing_provider,
}: schemas['SubscriptionResumedProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription has resumed`}
    >
      <Intro headline="Your subscription has resumed">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription is active again and your access has been restored. Regular
        billing has resumed.
      </Intro>
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Button href={url}>Manage subscription</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionResumed.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionResumed
