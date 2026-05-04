'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import { formatCurrency } from '@polar-sh/currency'
import { BillingPlan, BillingSubscription } from './mockData'

const formatPrice = formatCurrency('standard')

const STATUS_LABEL: Record<BillingSubscription['status'], string> = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  trialing: 'Trial',
}

const STATUS_COLOR: Record<
  BillingSubscription['status'],
  'green' | 'yellow' | 'red' | 'blue'
> = {
  active: 'green',
  past_due: 'yellow',
  canceled: 'red',
  trialing: 'blue',
}

const Detail = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col gap-y-1">
    <span className="dark:text-polar-500 text-sm text-gray-500">{label}</span>
    <span className="dark:text-white">{children}</span>
  </div>
)

export const BillingSubscriptionCard = ({
  subscription,
  plan,
  onChangePlan,
}: {
  subscription: BillingSubscription
  plan: BillingPlan
  onChangePlan: () => void
}) => {
  const intervalLabel = plan.interval === 'month' ? 'month' : 'year'

  return (
    <div className="dark:border-polar-700 flex flex-col gap-y-8 rounded-2xl border border-gray-200 p-6">
      <div className="flex flex-col gap-y-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-2">
            <h3 className="text-lg font-medium dark:text-white">{plan.name}</h3>
            <Pill color={STATUS_COLOR[subscription.status]}>
              {STATUS_LABEL[subscription.status]}
            </Pill>
            {subscription.cancelAtPeriodEnd && (
              <Pill color="yellow">Cancels at period end</Pill>
            )}
          </div>
          <p className="dark:text-polar-400 text-gray-500">
            {plan.description}
          </p>
        </div>
        <div className="flex flex-col items-start gap-y-1 md:items-end">
          <div className="flex items-baseline gap-x-1">
            <span className="text-2xl font-medium dark:text-white">
              {plan.contactSales
                ? 'Custom'
                : plan.amount === 0
                  ? 'Free'
                  : formatPrice(plan.amount, plan.currency)}
            </span>
            {!plan.contactSales && plan.amount > 0 && (
              <span className="dark:text-polar-400 text-gray-500">
                / {intervalLabel}
              </span>
            )}
          </div>
          {plan.fees.length > 0 && (
            <p className="dark:text-polar-500 text-gray-500 md:text-right">
              {plan.fees.join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="dark:border-polar-700 grid grid-cols-1 gap-6 border-t border-gray-200 pt-6 md:grid-cols-3">
        <Detail label="Started">
          <FormattedDateTime datetime={subscription.startedAt} />
        </Detail>
        <Detail
          label={subscription.cancelAtPeriodEnd ? 'Ends on' : 'Renews on'}
        >
          <FormattedDateTime datetime={subscription.currentPeriodEnd} />
        </Detail>
        <Detail label="Payment method">
          {subscription.paymentMethod.brand} ending in{' '}
          {subscription.paymentMethod.last4}
        </Detail>
      </div>

      <div className="flex flex-row flex-wrap gap-3">
        <Button onClick={onChangePlan}>Change plan</Button>
        <Button variant="ghost" disabled>
          Update payment method
        </Button>
      </div>
    </div>
  )
}
