import { Preview, Section } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionRevoked({
  email,
  organization,
  product,
  subscription,
  url,
}: schemas['SubscriptionRevokedProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your {product.name} subscription has ended</Preview>
      <Intro headline="Your subscription has ended">
        Your <span className="font-bold">{product.name}</span> subscription has
        ended. If you&rsquo;d like to resubscribe, you can do so anytime.
      </Intro>
      <Section className="my-4 text-center">
        <Button href={url}>View subscription</Button>
      </Section>

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionRevoked.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'canceled',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionRevoked
