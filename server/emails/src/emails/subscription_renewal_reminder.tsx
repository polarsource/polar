import {
  Button,
  FooterCustomer,
  WrapperOrganization,
} from '../components/layout'
import { Intro, Text } from '../components/text'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionRenewalReminder({
  email,
  organization,
  product,
  url,
  renewal_date,
}: schemas['SubscriptionRenewalReminderProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription renews on ${renewal_date}`}
    >
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
      <Text>
        If you&rsquo;d like to make any changes to your subscription, you can do
        so from your customer portal.
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
  },
  renewal_date: '04/15/2026',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionRenewalReminder
