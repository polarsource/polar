import { Heading, Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
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
      <Preview>Your subscription to {product.name} is now uncanceled</Preview>
      <Section>
        <Heading as="h1" className="text-xl font-bold text-gray-900">
          Your subscription is now uncanceled
        </Heading>
        <BodyText>
          Your subscription to <span className="font-bold">{product.name}</span>{' '}
          is no longer canceled.
        </BodyText>
      </Section>
      <Section className="my-8 text-center">
        <Button href={url}>Manage my subscription</Button>
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
