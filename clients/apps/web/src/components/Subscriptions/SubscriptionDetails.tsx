'use client'

import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import AmountLabel from '../Shared/AmountLabel'
import { SubscriptionStatus } from './SubscriptionStatus'

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
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">
            Subscription ID
          </span>
          <span className="dark:text-polar-500 font-mono text-sm text-gray-500">
            {subscription.id}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Status</span>
          <SubscriptionStatus subscription={subscription} />
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">
            Started Date
          </span>
          <span>
            <FormattedDateTime datetime={subscription.created_at} />
          </span>
        </div>
        {nextEventDatetime && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {subscription.ends_at ? 'Ending Date' : 'Renewal Date'}
            </span>
            <span>
              <FormattedDateTime datetime={nextEventDatetime} />
            </span>
          </div>
        )}
        {subscription.ended_at && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Ended Date
            </span>
            <span>
              <FormattedDateTime datetime={subscription.ended_at} />
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">
            Recurring Interval
          </span>
          <span>
            {subscription.recurring_interval === 'month' ? 'Month' : 'Year'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="dark:text-polar-500 text-gray-500">Discount</span>
          <span>
            {subscription.discount ? subscription.discount.code : '—'}
          </span>
        </div>
        {subscription.amount && subscription.currency && (
          <div className="flex justify-between">
            <span className="dark:text-polar-500 text-gray-500">Amount</span>
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription.recurring_interval}
            />
          </div>
        )}
      </div>

      {cancellationDate && (
        <div className="flex flex-col gap-y-4">
          <h3 className="text-lg">Cancellation Details</h3>
          <div className="flex flex-col gap-y-2">
            <div className="flex justify-between">
              <span className="dark:text-polar-500 text-gray-500">Ends</span>
              <span>
                {cancellationDate.toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="dark:text-polar-500 text-gray-500">Reason</span>
              <span>
                {cancellationReason
                  ? getHumanCancellationReason(cancellationReason)
                  : '—'}
              </span>
            </div>
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
