import {
  Button,
  Footer,
  Intro,
  Text,
  WrapperPolar,
} from '../components/foundation'
import type { schemas } from '../types'

export function NotificationSubscriptionCancellation({
  subscriber_name,
  subscriber_email,
  product_name,
  formatted_cancellation_reason,
  cancellation_comment,
  cancel_at_period_end,
  ends_at,
  subscription_url,
}: schemas['MaintainerSubscriptionCancellationNotificationPayload']) {
  const formattedName = subscriber_email ? (
    <>
      <Text as="span" weight="bold">
        {subscriber_name}
      </Text>{' '}
      ({subscriber_email})
    </>
  ) : (
    <Text as="span" weight="bold">
      {subscriber_name}
    </Text>
  )

  const formattedEndsAt =
    cancel_at_period_end && ends_at
      ? new Date(ends_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        })
      : null

  return (
    <WrapperPolar
      preview={`${subscriber_name} canceled their ${product_name} subscription`}
    >
      <Intro headline="Subscription canceled">
        {formattedName} canceled their{' '}
        <Text as="span" weight="bold">
          {product_name}
        </Text>{' '}
        subscription
        {formattedEndsAt
          ? `. They keep access until ${formattedEndsAt}, when the subscription will be revoked.`
          : ', effective immediately.'}
      </Intro>
      {formatted_cancellation_reason && (
        <Text>
          <Text as="span" weight="bold">
            Reason:
          </Text>{' '}
          {formatted_cancellation_reason}
        </Text>
      )}
      {cancellation_comment && (
        <Text>
          <Text as="span" weight="bold">
            Comment:
          </Text>{' '}
          {cancellation_comment}
        </Text>
      )}
      {subscription_url && (
        <Button href={subscription_url}>View subscription</Button>
      )}
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationSubscriptionCancellation.PreviewProps = {
  subscriber_name: 'John Doe',
  subscriber_email: 'john.doe@acme.com',
  product_name: 'Pro',
  organization_name: 'Acme Inc.',
  organization_slug: 'acme-inc',
  subscription_id: '7e4b1c3a-0f5d-4d2e-9b8a-1c2d3e4f5a6b',
  cancellation_reason: 'too_expensive',
  formatted_cancellation_reason: 'Too expensive',
  cancellation_comment: 'We are cutting costs this quarter.',
  cancel_at_period_end: true,
  ends_at: '2026-10-12T00:00:00Z',
  subscription_url:
    'https://polar.sh/dashboard/acme-inc/sales/subscriptions/7e4b1c3a-0f5d-4d2e-9b8a-1c2d3e4f5a6b',
}

export default NotificationSubscriptionCancellation
