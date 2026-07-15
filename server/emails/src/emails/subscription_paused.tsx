import {
  Button,
  FooterCustomer,
  Intro,
  Text,
  WrapperOrganization,
} from '../components/foundation'
import { organization, product } from '../preview'
import type { schemas } from '../types'

export function SubscriptionPaused({
  email,
  organization,
  product,
  subscription,
  url,
}: schemas['SubscriptionPausedProps']) {
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  const accessUntil = formatDate(subscription.current_period_end!)
  const resumeDate = subscription.resumes_at
    ? formatDate(subscription.resumes_at)
    : null

  return (
    <WrapperOrganization
      organization={organization}
      preview={`Your ${product.name} subscription will pause`}
    >
      <Intro headline="Your subscription is set to pause">
        Your{' '}
        <Text as="span" weight="medium">
          {product.name}
        </Text>{' '}
        subscription will pause at the end of your current period. You keep full
        access until {accessUntil}, and you won&rsquo;t be charged while
        it&rsquo;s paused.
      </Intro>
      <Text>
        {resumeDate
          ? `Your subscription will automatically resume on ${resumeDate}.`
          : 'Your subscription will stay paused until you resume it.'}
      </Text>
      <Button href={url}>Manage subscription</Button>
      <FooterCustomer organization={organization} email={email} />
    </WrapperOrganization>
  )
}

SubscriptionPaused.PreviewProps = {
  email: 'john@example.com',
  organization,
  product,
  subscription: {
    current_period_end: new Date(
      Date.now() + 10 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    resumes_at: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
  },
  url: 'https://polar.sh/acme-inc/portal/subscriptions/12345',
}

export default SubscriptionPaused
