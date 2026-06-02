import {
  Button,
  FooterCustomer,
  WrapperOrganization,
} from '../components/layout'
import { Intro, Text } from '../components/text'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionUncanceled({
  email,
  organization,
  product,
  url,
}: schemas['SubscriptionUncanceledProps']) {
  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription is no longer canceled`}
    >
      <Intro headline="Your subscription is no longer canceled">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription will continue as normal.
      </Intro>
      <Button href={url}>Manage subscription</Button>
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
