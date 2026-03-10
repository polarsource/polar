import { Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionRenewalReminder({
  email,
  organization,
  product,
  subscription,
  url,
  renewal_date,
}: schemas['SubscriptionRenewalReminderProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>
        Your subscription to {product.name} will renew on {renewal_date}
      </Preview>
      <Intro headline="Upcoming subscription renewal">
        Your subscription to{' '}
        <span className="font-medium">{product.name}</span> will automatically
        renew on {renewal_date}.
      </Intro>
      <BodyText>
        If you wish to make any changes to your subscription, you can manage it
        from your customer portal.
      </BodyText>
      <Section className="my-8 text-center">
        <Button href={url}>Manage subscription</Button>
      </Section>

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionRenewalReminder.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {},
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
  renewal_date: 'April 15, 2026',
}

export default SubscriptionRenewalReminder
