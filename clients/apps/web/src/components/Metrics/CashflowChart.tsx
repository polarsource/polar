import { useMetrics } from '@/hooks/queries'
import { useOrders } from '@/hooks/queries/orders'
import {
  formatAccountingFriendlyCurrency,
  formatCurrency,
  formatSubCentCurrency,
} from '@/utils/formatters'
import { getTimestampFormatter } from '@/utils/metrics'
import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { startOfDay, subDays } from 'date-fns'
import {
  CircleDollarSignIcon,
  CircleFadingPlusIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import Spinner from '../Shared/Spinner'

interface CashflowChartProps {
  className?: string
  organizationId?: string
  customerId?: string
  customerCreatedAt?: string
}

const CashflowChart = ({
  className,
  organizationId,
  customerId,
  customerCreatedAt,
}: CashflowChartProps) => {
  const startDate = useMemo(() => {
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30))
    if (customerCreatedAt) {
      const createdAtDate = new Date(customerCreatedAt)
      return createdAtDate > thirtyDaysAgo ? createdAtDate : thirtyDaysAgo
    }
    return thirtyDaysAgo
  }, [customerCreatedAt])
  const endDate = useMemo(() => new Date(), [])

  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    startDate,
    endDate,
    organization_id: organizationId,
    interval: 'day',
    customer_id: customerId ? [customerId] : undefined,
  })

  const timestampFormatter = getTimestampFormatter('day')

  const maxDailyCost = useMemo(
    () =>
      (metricsData?.periods ?? []).reduce(
        (max, period) => Math.max(max, Math.abs(period.costs ?? 0), 0),
        0,
      ),
    [metricsData],
  )

  const { data: ordersData } = useOrders(organizationId, {
    customer_id: customerId,
    limit: 100,
    sorting: ['-created_at'],
  })

  const ordersByDate = useMemo(() => {
    if (!ordersData?.items) return {}

    const grouped: Record<string, schemas['Order'][]> = {}
    const cutoffDate = startDate.toISOString()

    ordersData.items.forEach((order) => {
      if (order.created_at < cutoffDate) {
        return
      }

      if (order.net_amount <= 0) {
        return
      }

      const dateKey = new Date(order.created_at).toISOString().split('T')[0]

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(order)
    })

    return grouped
  }, [ordersData, startDate])

  return (
    <ShadowBox
      className={twMerge(
        'dark:bg-polar-800 flex w-full flex-col bg-gray-50 p-2 shadow-xs',
        className,
      )}
    >
      <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-row gap-x-4">
            <h3 className="text-xl">Cashflow</h3>
            <span className="dark:text-polar-500 text-xl text-gray-500">
              Last 30 Days
            </span>
          </div>
          <h3 className="text-5xl font-light">
            {formatAccountingFriendlyCurrency(
              metricsData ? (metricsData.totals.cashflow ?? 0) : 0,
              'usd',
            )}
          </h3>
        </div>
      </div>
      <div className="dark:bg-polar-900 flex max-h-[464px] w-full flex-col gap-y-2 overflow-y-auto rounded-3xl bg-white p-4 pl-8">
        {metricsLoading ? (
          <div className="flex flex-col items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <dl className="space-y-2">
            {[...(metricsData?.periods ?? [])].reverse().map((period) => {
              // Annoying hoop to get ISO date without jumping timezones
              const dateKey = new Date(
                Date.UTC(
                  period.timestamp.getFullYear(),
                  period.timestamp.getMonth(),
                  period.timestamp.getDate(),
                ),
              )
                .toISOString()
                .split('T')[0]
              const dayOrders = ordersByDate[dateKey] || []

              return (
                <div
                  key={period.timestamp}
                  className="flex items-start justify-start gap-x-4"
                >
                  <dt className="flex h-8 w-14 flex-none items-center justify-start text-sm text-gray-500 tabular-nums">
                    {timestampFormatter(period.timestamp)}
                  </dt>
                  <dd className="w-full space-y-2">
                    <div className="dark:bg-polar-800 flex h-8 w-full items-center justify-start rounded-full bg-gray-100">
                      <div
                        className="flex h-full min-w-fit items-center justify-start rounded-full bg-red-500 px-[7px] text-right text-sm text-white data-empty:text-black/20"
                        style={{
                          width: maxDailyCost
                            ? `${(Math.abs(period.costs ?? 0) / maxDailyCost) * 100}%`
                            : '0%',
                        }}
                        data-empty={period.costs === 0 ? true : undefined}
                      >
                        {formatSubCentCurrency(
                          Math.abs(period.costs ?? 0),
                          'usd',
                        )}
                      </div>
                    </div>
                    {dayOrders.length > 0 && (
                      <ul className="space-y-2">
                        {dayOrders.map((order) => (
                          <li
                            key={order.id}
                            className="flex h-8 w-full items-center justify-start gap-x-2 rounded-full bg-gray-100 text-sm text-emerald-500"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                              {order.billing_reason === 'purchase' ? (
                                <CircleDollarSignIcon
                                  strokeWidth={1.5}
                                  className="size-4.5"
                                />
                              ) : order.billing_reason ===
                                'subscription_create' ? (
                                <CircleFadingPlusIcon
                                  strokeWidth={1.5}
                                  className="size-4.5"
                                />
                              ) : order.billing_reason ===
                                'subscription_cycle' ? (
                                <RefreshCwIcon
                                  strokeWidth={1.5}
                                  className="size-4"
                                />
                              ) : order.billing_reason ===
                                'subscription_update' ? (
                                <CircleFadingPlusIcon
                                  strokeWidth={1.5}
                                  className="size-4.5"
                                />
                              ) : (
                                order.billing_reason
                              )}
                            </span>
                            {order.description} -{' '}
                            {formatCurrency(order.net_amount, order.currency)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        )}
      </div>
    </ShadowBox>
  )
}

export default CashflowChart
