import Text from '../components/text/Text'
import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import FooterCustomer from '../components/layout/FooterCustomer'
import Intro from '../components/text/Intro'
import WrapperOrganization from '../components/layout/WrapperOrganization'
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

      <CTASection>
        <Button href={url}>Manage subscription</Button>
      </CTASection>

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
