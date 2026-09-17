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

export function SubscriptionUncanceled({
  email,
  organization,
  product,
  url,
  previous_billing_provider,
}: schemas['SubscriptionUncanceledProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription is no longer canceled`}
    >
      <Intro headline="Your subscription is no longer canceled">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription will continue as normal.
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

SubscriptionUncanceled.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUncanceled
