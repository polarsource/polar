'use client'

import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { DetailRow } from '../Shared/DetailRow'
import { SubscriptionStatus } from './SubscriptionStatus'

const formatRecurringSchedule = (
  interval: schemas['SubscriptionRecurringInterval'],
  intervalCount: number | null,
): string => {
  const count = intervalCount && intervalCount > 1 ? intervalCount : null

  if (count) {
    const intervalLabel =
      interval === 'day'
        ? 'Day'
        : interval === 'week'
          ? 'Week'
          : interval === 'month'
            ? 'Month'
            : 'Year'
    const pluralLabel = `${intervalLabel}${count > 1 ? 's' : ''}`
    return `Every ${count} ${pluralLabel}`
  }

  switch (interval) {
    case 'day':
      return 'Daily'
    case 'week':
      return 'Weekly'
    case 'month':
      return 'Monthly'
    case 'year':
      return 'Yearly'
    default:
      return interval
  }
}

const CANCELLATION_REASONS: {
  [key: string]: string
} = {
  unused: 'Unused',
  too_expensive: 'Too Expensive',
  missing_features: 'Missing Features',
  switched_service: 'Switched Service',
  customer_service: 'Customer Service',
  low_quality: 'Low Quality',
  too_complex: 'Too Complicated',
  other: 'Other',
}

const getHumanCancellationReason = (key: string | null) => {
  if (key && key in CANCELLATION_REASONS) {
    return CANCELLATION_REASONS[key]
  }
  return null
}

interface SubscriptionDetailsProps {
  subscription: schemas['Subscription']
}

const SubscriptionDetails = ({ subscription }: SubscriptionDetailsProps) => {
  const cancellationReason = subscription.customer_cancellation_reason
  const cancellationComment = subscription.customer_cancellation_comment

  let nextEventDatetime: string | undefined = undefined
  let cancellationDate: Date | undefined = undefined
  if (subscription.ended_at) {
    cancellationDate = new Date(subscription.ended_at)
  } else if (subscription.ends_at) {
    nextEventDatetime = subscription.ends_at
    cancellationDate = new Date(subscription.ends_at)
  } else if (subscription.current_period_end) {
    nextEventDatetime = subscription.current_period_end
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <DetailRow
          label="Subscription ID"
          value={subscription.id}
          valueClassName="font-mono text-sm"
        />
        <DetailRow
          label="Status"
          value={<SubscriptionStatus subscription={subscription} />}
        />
        <DetailRow
          label="Started Date"
          value={<FormattedDateTime datetime={subscription.created_at} />}
        />

        {subscription.status === 'trialing' && subscription.trial_end && (
          <DetailRow
            label="Trial End Date"
            value={<FormattedDateTime datetime={subscription.trial_end} />}
          />
        )}

        {nextEventDatetime && (
          <DetailRow
            label={subscription.ends_at ? 'Ending Date' : 'Renewal Date'}
            value={<FormattedDateTime datetime={nextEventDatetime} />}
          />
        )}

        {subscription.ended_at && (
          <DetailRow
            label="Ended Date"
            value={<FormattedDateTime datetime={subscription.ended_at} />}
          />
        )}

        <DetailRow
          label="Billing Schedule"
          value={formatRecurringSchedule(
            subscription.recurring_interval,
            subscription.recurring_interval_count,
          )}
        />

        <DetailRow
          label="Discount"
          value={subscription.discount ? subscription.discount.code : '—'}
        />

        <DetailRow
          label="Amount"
          value={
            subscription.amount
              ? formatCurrencyAndAmount(
                  subscription.amount,
                  subscription.currency,
                )
              : '—'
          }
        />
      </div>

      {cancellationDate && (
        <div className="flex flex-col gap-y-4">
          <h3 className="text-lg">Cancellation Details</h3>
          <div className="flex flex-col gap-y-2">
            <DetailRow
              label="Ends"
              value={cancellationDate.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />

            <DetailRow
              label="Reason"
              value={
                cancellationReason
                  ? getHumanCancellationReason(cancellationReason)
                  : '—'
              }
            />
          </div>
          {cancellationComment && (
            <TextArea tabIndex={-1} readOnly resizable={false}>
              {cancellationComment}
            </TextArea>
          )}
        </div>
      )}
    </>
  )
}

export default SubscriptionDetails
