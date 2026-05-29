import Text from '../components/text/Text'
import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import FooterCustomer from '../components/layout/FooterCustomer'
import Intro from '../components/text/Intro'
import WrapperOrganization from '../components/layout/WrapperOrganization'
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
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription has ended`}
    >
      <Intro headline="Your subscription has ended">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription has ended. If you&rsquo;d like to resubscribe, you can do
        so anytime.
      </Intro>
      <CTASection>
        <Button href={url}>View subscription</Button>
      </CTASection>

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
