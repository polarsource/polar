import { Link } from 'react-email'
import { Divider, Text } from './foundation'
import { formatCurrency } from './OrderSummary'
import type { schemas } from '../types'

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

const formatInterval = (
  interval: schemas['SubscriptionEmail']['recurring_interval'],
  count: number,
): string => (count > 1 ? `every ${count} ${interval}s` : `every ${interval}`)

interface SubscriptionTermsNoticeProps {
  productName: string
  subscription: schemas['SubscriptionEmail']
  regularAmount?: number | null
  portalUrl: string
}

export function SubscriptionTermsNotice({
  productName,
  subscription,
  regularAmount,
  portalUrl,
}: SubscriptionTermsNoticeProps) {
  const { amount, currency, trial_end } = subscription
  if (amount === 0 && !regularAmount) {
    return null
  }

  const interval = formatInterval(
    subscription.recurring_interval,
    subscription.recurring_interval_count,
  )
  const formattedAmount =
    subscription.tax_behavior === 'inclusive'
      ? formatCurrency(amount, currency)
      : `${formatCurrency(amount, currency)} (plus applicable taxes)`
  const price = regularAmount
    ? `${formattedAmount} while your discount applies and ${formatCurrency(regularAmount, currency)} after it ends,`
    : formattedAmount
  const portalLink = (
    <Link href={portalUrl} className="text-gray-500 underline">
      Customer Portal
    </Link>
  )

  return (
    <>
      <Divider />
      <Text variant="footnote" noMargin>
        {subscription.status === 'trialing' && trial_end ? (
          <>
            Your {productName} trial ends on {formatDate(trial_end)}. After
            that, your subscription renews automatically {interval} at {price}{' '}
            until you cancel. To avoid being charged, cancel anytime before{' '}
            {formatDate(trial_end)} in the {portalLink}. If you cancel, your
            access continues until the end of your trial.
          </>
        ) : (
          <>
            Your {productName} subscription renews automatically {interval} at{' '}
            {price} until you cancel. You can cancel anytime in the {portalLink}
            . Cancellation takes effect at the end of your current billing
            period.
          </>
        )}
      </Text>
    </>
  )
}

export default SubscriptionTermsNotice
