import { Preview, Section } from '@react-email/components'
import BodyText from '../components/BodyText'
import Button from '../components/Button'
import FooterCustomer from '../components/FooterCustomer'
import Intro from '../components/Intro'
import WrapperOrganization from '../components/WrapperOrganization'
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
    <WrapperOrganization organization={organization}>
      <Preview>
        Your subscription to {product.name} will end on {endDate}
      </Preview>
      <Intro headline="Your subscription has been canceled">
        Your subscription to <span className="font-medium">{product.name}</span>{' '}
        has been canceled. You&rsquo;ll still have full access until {endDate}.
      </Intro>
      <BodyText>
        If you&rsquo;d like to continue, you can renew anytime before then.
      </BodyText>
      <Section className="my-8 text-center">
        <Button href={url}>Renew subscription</Button>
      </Section>

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
