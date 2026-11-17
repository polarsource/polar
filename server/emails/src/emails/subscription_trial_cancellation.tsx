import BillingMigrationNotice from '../components/BillingMigrationNotice'
import {
  Button,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import { formatDate } from '../utils/formatters'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionTrialCancellation({
  email,
  organization,
  product,
  subscription,
  url,
  previous_billing_provider,
}: schemas['SubscriptionTrialCancellationProps']) {
  const endDate = formatDate(subscription.ends_at!)

  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} trial will end on ${endDate}`}
    >
      <Intro headline="Your trial has been canceled">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        trial has been canceled and won&rsquo;t convert to a paid subscription.
        You still have full access until the trial ends on {endDate}.
      </Intro>
      {previous_billing_provider && organization.name && (
        <BillingMigrationNotice
          organizationName={organization.name}
          previousBillingProvider={previous_billing_provider}
        />
      )}
      <Text>
        If you change your mind, you can keep your subscription anytime before
        your trial ends.
      </Text>
      <Button href={url}>Keep subscription</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionTrialCancellation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  previous_billing_provider: 'Stripe',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionTrialCancellation
