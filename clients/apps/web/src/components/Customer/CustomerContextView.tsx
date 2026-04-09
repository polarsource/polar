'use client'

import { StatisticCard } from '@/components/Shared/StatisticCard'
import { useMetrics } from '@/hooks/queries/metrics'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Pill from '@polar-sh/ui/components/atoms/Pill'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { DetailRow } from '../Shared/DetailRow'
import { useSubscriptions } from '@/hooks/queries'
import { PropsWithChildren } from 'react'

interface CustomerContextViewProps {
  organization: schemas['Organization']
  customer:
    | schemas['Customer']
    | schemas['OrderCustomer']
    | schemas['SubscriptionCustomer']
}

export const CustomerContextView = ({
  organization,
  customer,
}: CustomerContextViewProps) => {
  const metrics = useMetrics({
    startDate: new Date(customer.created_at),
    endDate: new Date(),
    organization_id: organization.id,
    interval: 'month',
    customer_id: [customer.id],
  })

  const customerSubscriptions = useSubscriptions(organization.id, {
    customer_id: [customer.id],
  })

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      <ContextCard>
        <div className="flex flex-row items-center gap-4">
          <Avatar
            avatar_url={customer.avatar_url}
            name={customer.name || customer.email || '—'}
            className="size-12 text-sm"
          />
          <div className="flex flex-col">
            {(customer.name?.length ?? 0) > 0 ? customer.name : '—'}
            {customer.deleted_at && (
              <Pill className="ml-2 text-xs" color="red">
                Deleted
              </Pill>
            )}

            <div className="dark:text-polar-500 flex flex-row items-center gap-1 text-sm text-gray-500">
              {customer.email}
            </div>
          </div>
        </div>

        <div className="flex flex-row justify-between gap-4">
          <StatisticCard title="Cumulative Revenue">
            {formatCurrency('statistics')(
              metrics.data?.periods[metrics.data.periods.length - 1]
                .cumulative_revenue ?? 0,
              'usd',
            )}
          </StatisticCard>
          <StatisticCard title="First Seen">
            <FormattedDateTime datetime={customer.created_at} />
          </StatisticCard>
        </div>
        <Link
          href={`/dashboard/${organization.slug}/customers/${customer.id}?query=${customer.email}`}
          className="flex flex-row items-center gap-4"
        >
          <Button className="w-full" size="lg" variant="secondary">
            View Customer
          </Button>
        </Link>
      </ContextCard>
      <ContextCard>
        <div className="flex flex-col">
          {!customer.deleted_at && (
            <DetailRow
              labelClassName="flex-none md:basis-24"
              valueClassName="font-mono"
              label="ID"
              value={customer.id}
            />
          )}
          <DetailRow
            labelClassName="flex-none md:basis-24"
            valueClassName="font-mono"
            label="External ID"
            value={customer.external_id ?? '—'}
          />
          <DetailRow
            labelClassName="flex-none md:basis-24"
            label="Email"
            value={customer.email}
          />
          <DetailRow
            labelClassName="flex-none md:basis-24"
            label="Name"
            value={customer.name}
          />
          <DetailRow
            labelClassName="flex-none md:basis-24"
            label="Tax ID"
            value={
              customer.tax_id ? (
                <span className="flex flex-row items-center gap-1.5">
                  <span>{customer.tax_id[0]}</span>
                  <span className="font-mono text-xs opacity-70">
                    {customer.tax_id[1].toLocaleUpperCase().replace('_', ' ')}
                  </span>
                </span>
              ) : (
                '—'
              )
            }
          />
          <DetailRow
            labelClassName="flex-none md:basis-24"
            label="Created At"
            value={<FormattedDateTime datetime={customer.created_at} />}
          />
        </div>
      </ContextCard>
      {(customerSubscriptions.data?.pagination.total_count ?? 0) > 0 ? (
        <ContextCard>
          <h4 className="text-lg">Subscriptions</h4>

          <div className="flex flex-col gap-4 md:gap-0">
            {[...(customerSubscriptions.data?.items ?? [])]
              .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
              .map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  organization={organization}
                />
              ))}
          </div>
        </ContextCard>
      ) : null}

      {!customer.deleted_at && Object.keys(customer.metadata).length > 0 && (
        <ContextCard>
          <div className="flex flex-row items-center justify-between gap-2">
            <h3 className="text-lg">Metadata</h3>
          </div>
          {Object.entries(customer.metadata).map(([key, value]) => (
            <DetailRow key={key} label={key} value={value} />
          ))}
        </ContextCard>
      )}
    </div>
  )
}

type ContextCardProps = PropsWithChildren & {}

const ContextCard = (props: ContextCardProps) => {
  return (
    <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:shadow-xs lg:rounded-2xl">
      {props.children}
    </ShadowBox>
  )
}

const STATUS_DISPLAY_NAMES: Record<schemas['SubscriptionStatus'], string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  unpaid: 'Unpaid',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
}

const STATUS_ORDER: Record<schemas['SubscriptionStatus'], number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  incomplete: 4,
  canceled: 5,
  incomplete_expired: 6,
}

const STATUS_COLORS: Record<schemas['SubscriptionStatus'], string> = {
  active: 'border-green-500',
  trialing: 'border-blue-500',
  past_due: 'border-yellow-500',
  unpaid: 'border-orange-500',
  canceled: 'border-red-500',
  incomplete: 'dark:border-polar-500 border-gray-500',
  incomplete_expired: 'dark:border-polar-500 border-gray-500',
}

const INTERVAL_LABELS: Record<
  schemas['SubscriptionRecurringInterval'],
  string
> = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }

const INTERVAL_PLURAL: Record<
  schemas['SubscriptionRecurringInterval'],
  string
> = { day: 'days', week: 'weeks', month: 'months', year: 'years' }

const formatInterval = (
  interval: schemas['SubscriptionRecurringInterval'],
  count: number,
): string =>
  count === 1
    ? INTERVAL_LABELS[interval]
    : `Every ${count} ${INTERVAL_PLURAL[interval]}`

interface SubscriptionRowProps {
  subscription: schemas['Subscription']
  organization: schemas['Organization']
}

const SubscriptionRow = ({
  subscription,
  organization,
}: SubscriptionRowProps) => {
  const statusColor =
    subscription.cancel_at_period_end && subscription.status === 'active'
      ? 'border-yellow-500'
      : STATUS_COLORS[subscription.status]

  const formattedPrice =
    subscription.amount === 0
      ? 'Free'
      : subscription.amount != null && subscription.currency
        ? `${formatCurrency('standard')(subscription.amount, subscription.currency)} / ${formatInterval(subscription.recurring_interval, subscription.recurring_interval_count)}`
        : null

  return (
    <Link
      href={`/dashboard/${organization.slug}/sales/subscriptions/${subscription.id}`}
      className="dark:hover:bg-polar-800 -mx-4 flex flex-row items-center justify-between gap-3 rounded-lg px-4 py-2 hover:bg-gray-100"
    >
      <div className="flex flex-row items-center gap-4 overflow-hidden">
        <span
          className={`size-2 shrink-0 rounded-full ${statusColor} border-2`}
          title={
            subscription.cancel_at_period_end
              ? 'Canceling at period end'
              : subscription.status
          }
        />
        <span className="truncate text-sm">{subscription.product.name}</span>
        <span className="dark:text-polar-500 text-sm text-gray-500">
          {subscription.status === 'active'
            ? formatInterval(
                subscription.recurring_interval,
                subscription.recurring_interval_count,
              )
            : STATUS_DISPLAY_NAMES[subscription.status]}
        </span>
      </div>
      {formattedPrice && (
        <span className="dark:text-polar-400 shrink-0 text-sm text-gray-500">
          {formattedPrice}
        </span>
      )}
    </Link>
  )
}
