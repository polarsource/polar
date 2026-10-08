import { Link } from 'react-email'
import { Divider, Text } from './foundation'
import { formatCurrency, formatDate, formatInterval } from '../utils/formatters'
import type { schemas } from '../types'

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
  const formatAmount = (value: number): string =>
    subscription.tax_behavior === 'exclusive'
      ? `${formatCurrency(value, currency)} (plus applicable taxes)`
      : formatCurrency(value, currency)
  const price = regularAmount
    ? `${formatAmount(amount)} while your discount applies and ${formatAmount(regularAmount)} after it ends,`
    : formatAmount(amount)
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
