import { Preview } from '@react-email/components'
import Footer from '../components/Footer'
import IntroWithHi from '../components/IntroWithHi'
import PolarHeader from '../components/PolarHeader'
import Wrapper from '../components/Wrapper'
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
    <Wrapper>
      <Preview>New {tier_name} subscriber</Preview>
      <PolarHeader />
      <IntroWithHi hiMsg="Congratulations!">
        {subscriber_name} is now subscribing to <strong>{tier_name}</strong> for{' '}
        {tier_price_amount ? formatted_price_amount : 'free'}/
        {tier_price_recurring_interval}.
      </IntroWithHi>
      <Footer email={null} />
    </Wrapper>
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
