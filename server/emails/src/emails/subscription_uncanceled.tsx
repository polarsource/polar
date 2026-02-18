import { Preview, Section } from '@react-email/components'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionUncanceled({
  email,
  organization,
  product,
  subscription,
  url,
}: schemas['SubscriptionUncanceledProps']) {
  return (
    <WrapperOrganization organization={organization}>
      <Preview>Your {product.name} subscription is no longer canceled</Preview>

      <Intro headline="Your subscription is no longer canceled">
        Your {product.name} subscription will continue as normal.
      </Intro>

      <Section className="mt-2 mb-8 text-center">
        <Button href={url}>Manage subscription</Button>
      </Section>

      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionUncanceled.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    id: '12345',
    status: 'active',
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionUncanceled
