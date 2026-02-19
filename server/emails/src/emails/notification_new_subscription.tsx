import { Preview } from '@react-email/components'
import Footer from '../components/Footer'
import Intro from '../components/Intro'
import WrapperPolar from '../components/WrapperPolar'
import type { schemas } from '../types'

export function NotificationNewSubscription({
  subscriber_name,
  formatted_price_amount,
  tier_name,
  tier_price_amount,
  tier_price_recurring_interval,
  tier_organization_name,
}: schemas['MaintainerNewPaidSubscriptionNotificationPayload']) {
  return (
    <WrapperPolar>
      <Preview>New {tier_name} subscriber</Preview>
      <Intro headline="Congratulations!">
        {subscriber_name} is now subscribing to <strong>{tier_name}</strong> for{' '}
        {tier_price_amount ? formatted_price_amount : 'free'}/
        {tier_price_recurring_interval}.
      </Intro>
      <Footer email={null} />
    </WrapperPolar>
  )
}

NotificationNewSubscription.PreviewProps = {
  subscriber_name: 'John Doe',
  formatted_price_amount: '$12.95',
  tier_name: 'Pro',
  tier_price_amount: 1295,
  tier_price_recurring_interval: 'monthly',
  tier_organization_name: 'Acme Inc.',
}

export default NotificationNewSubscription
