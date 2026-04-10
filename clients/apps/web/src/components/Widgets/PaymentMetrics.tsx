import {
  useMetrics,
  useOrganizationAccount,
  useTransactionsSummary,
} from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { formatCurrency } from '@polar-sh/currency'
import { useContext } from 'react'

const MetricCard = ({
  title,
  value,
  isLoading,
}: {
  title: string
  value: string
  isLoading: boolean
}) => (
  <div className="dark:border-polar-700 flex flex-col gap-y-2 border-r border-gray-200 px-6 py-6 last:border-r-0">
    <span className="dark:text-polar-500 text-sm text-gray-500">{title}</span>
    {isLoading ? (
      <div className="dark:bg-polar-700 h-7 w-24 animate-pulse rounded-md bg-gray-200" />
    ) : (
      <span className="text-lg font-medium">{value}</span>
    )}
  </div>
)

export const PaymentMetrics = () => {
  const { organization } = useContext(OrganizationContext)

  const { data: metricsData, isLoading: metricsLoading } = useMetrics({
    startDate: new Date(organization.created_at),
    endDate: new Date(),
    organization_id: organization.id,
    interval: 'year',
    metrics: ['orders', 'revenue', 'net_revenue'],
  })

  const { data: account } = useOrganizationAccount(organization.id)
  const { data: summary, isLoading: summaryLoading } = useTransactionsSummary(
    account?.id ?? '',
  )

  const fmt = formatCurrency('compact')

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Payments"
        value={String(metricsData?.totals.orders ?? 0)}
        isLoading={metricsLoading}
      />
      <MetricCard
        title="Total Amount"
        value={fmt(metricsData?.totals.revenue ?? 0, 'usd')}
        isLoading={metricsLoading}
      />
      <MetricCard
        title="Total Net Amount"
        value={fmt(metricsData?.totals.net_revenue ?? 0, 'usd')}
        isLoading={metricsLoading}
      />
      <MetricCard
        title="Current Balance"
        value={fmt(
          summary?.balance.amount ?? 0,
          summary?.balance.currency ?? 'usd',
        )}
        isLoading={summaryLoading}
      />
    </div>
  )
}
