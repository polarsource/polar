import { Preview, Section } from 'react-email'
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
        will automatically renew on{' '}
        <span className="font-medium">{renewal_date}</span>.
      </Intro>

      <BodyText>
        If you&rsquo;d like to make any changes to your subscription, you can do
        so from your customer portal.
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
  renewal_date: '04/15/2026',
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionRenewalReminder
