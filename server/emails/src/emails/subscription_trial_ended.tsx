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

export function SubscriptionTrialEnded({
  email,
  organization,
  product,
  url,
  previous_billing_provider,
}: schemas['SubscriptionTrialEndedProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} trial has ended`}
    >
      <Intro headline="Your trial has ended">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        trial has ended and you won&rsquo;t be charged. If you&rsquo;d like to
        subscribe, you can do so anytime.
      </Intro>
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Button href={url}>View subscription</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionTrialEnded.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'canceled',
  },
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionTrialEnded
