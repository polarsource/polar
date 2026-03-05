import { Preview } from '@react-email/components'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function NotificationSubscriptionCanceled({
  subscriber_name,
  formatted_price_amount,
  tier_name,
  tier_price_amount,
  tier_price_recurring_interval,
  tier_organization_name,
  cancel_at_period_end,
  cancellation_reason,
  cancellation_comment,
}: schemas['MaintainerSubscriptionCanceledNotificationPayload']) {
  return (
    <WrapperPolar>
      <Preview>
        {subscriber_name} has canceled {tier_name}
      </Preview>
      <Intro headline="Subscription Canceled">
        {subscriber_name} has canceled their subscription to{' '}
        <strong>{tier_name}</strong> (
        {tier_price_amount ? formatted_price_amount : 'free'}/
        {tier_price_recurring_interval}).
        {cancel_at_period_end
          ? ' The subscription will remain active until the end of the current billing period.'
          : ' The subscription has been canceled immediately.'}
        {cancellation_reason && (
          <>
            <br />
            <br />
            <strong>Reason:</strong> {cancellation_reason}
          </>
        )}
        {cancellation_comment && (
          <>
            <br />
            <strong>Comment:</strong> {cancellation_comment}
          </>
        )}
      </Intro>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationSubscriptionCanceled.PreviewProps = {
  subscriber_name: 'John Doe',
  formatted_price_amount: '$12.95',
  tier_name: 'Pro',
  tier_price_amount: 1295,
  tier_price_recurring_interval: 'monthly',
  tier_organization_name: 'Acme Inc.',
  cancel_at_period_end: true,
  cancellation_reason: 'too_expensive',
  cancellation_comment: 'Switching to a different provider',
}

export default NotificationSubscriptionCanceled
