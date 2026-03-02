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
        Your {product.name} subscription renews on {renewal_date}
      </Preview>

      <Intro headline="Upcoming subscription renewal">
        Your <span className="font-medium">{product.name}</span> subscription
        will automatically renew on {renewal_date}.
      </Intro>

      <BodyText>
        No action is needed if you&rsquo;d like to continue your subscription.
        If you wish to make changes or cancel, you can do so from your portal.
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
  subscription: {
    id: '12345',
    status: 'active',
  },
  renewal_date: 'March 9, 2026',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionRenewalReminder
