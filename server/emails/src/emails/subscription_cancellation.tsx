import Button from '../components/layout/Button'
import CTASection from '../components/layout/CTASection'
import FooterCustomer from '../components/layout/FooterCustomer'
import Intro from '../components/text/Intro'
import Text from '../components/text/Text'
import WrapperOrganization from '../components/layout/WrapperOrganization'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionCancellation({
  email,
  organization,
  product,
  subscription,
  url,
}: schemas['SubscriptionCancellationProps']) {
  const endDate = new Date(subscription.ends_at!).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your subscription to ${product.name} will end on ${endDate}`}
    >
      <Intro headline="Your subscription has been canceled">
        Your subscription to{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        has been canceled. You still have full access until {endDate}.
      </Intro>
      <Text>If you change your mind, you can renew anytime before then.</Text>
      <CTASection>
        <Button href={url}>Renew subscription</Button>
      </CTASection>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionCancellation.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionCancellation
