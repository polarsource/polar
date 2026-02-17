import { Heading, Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
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
      <Preview>Your subscription to {product.name} has now ended</Preview>
      <Section>
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription has now ended
        </Heading>
        <BodyText>
          Thank you for being a subscriber of{' '}
          <span className="font-bold">{product.name}</span>.
        </BodyText>
        <BodyText>
          We hope to see you again in the future - you're always welcome back.
        </BodyText>
      </Section>
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
